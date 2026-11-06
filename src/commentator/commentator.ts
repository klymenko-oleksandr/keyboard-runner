// FACADE: the game knows only these six methods ("the race was announced", "a driver typed something"...).
// Behind them: the comment factory, driver profiles, timers for status reports and jokes,
// race moments detection and the broadcaster (wrapped by the censorship proxy).
import { partial } from 'lodash';
import { SECONDS_FOR_GAME } from '../socket/config';
import { getSpeed } from '../socket/helpers/roomHelpers';
import {
	FILLER_CHECK_MS,
	FILLER_QUIET_SECONDS,
	MIN_SECONDS_LEFT_FOR_STATUS,
	OVERTAKE_GRACE_SECONDS,
	STATUS_INTERVAL_SECONDS,
} from './config';
import { FILLERS, WEATHER } from './comments/phrases';
import { pairKey } from './drivers/driverRepository';
import { getUnused, pickWith } from './helpers/random';
import {
	filterAnnounceableOvertakes,
	findComeback,
	findRivalry,
	getPreviousFinisher,
	getSpeedNews,
	updateWorstPositions,
} from './helpers/raceMoments';
import {
	findOvertaken,
	getSecondsLeft,
	getStandings,
	isApproachMoment,
	isFinishMoment,
	rankPlayers,
	toOrder,
} from './helpers/standings';
import { toPreracePayload, toResultsPayload, toStatusPayload } from './ai/payloads';
import type { AiCommentator } from './ai/aiCommentator';
import type { CreateComment } from './comments/commentFactory';
import type { DriverRepository } from './drivers/driverRepository';
import type { BookInfo } from '../texts';
import type { GameResultDto, Room } from '../socket/types';
import type { Broadcaster, CommentPayloads, CommentType, Random } from './types';

export interface Commentator {
	/** countdown started: greeting, the grid, an old rivalry, today's book */
	raceAnnounced: (room: Room) => void;
	/** lights out: start + status reports every 30 s + jokes in the pauses */
	raceStarted: (room: Room) => void;
	/** after every accepted progress update: overtakes, "30 chars to go", finish line */
	progressUpdated: (room: Room, username: string, previousTypedChars: number) => void;
	/** a driver left during the countdown or the race */
	driverLeft: (room: Room, username: string) => void;
	/** the race is over: podium, comeback, win streak, driver stats, silence */
	raceFinished: (room: Room, results: GameResultDto[]) => void;
	/** the room is gone: stop all timers */
	roomClosed: (room: Room) => void;
}

interface CommentatorDeps {
	broadcaster: Broadcaster;
	drivers: DriverRepository;
	createComment: CreateComment;
	/** which book today's text comes from (null for the classic texts) */
	getBook?: (textId: number) => BookInfo | null;
	/** AI lines for some slots (status, results); without it every comment is a template */
	ai?: AiCommentator;
	random?: Random;
	now?: () => number;
}

/** What the commentator remembers during one race in one room */
interface RaceSession {
	timers: Array<ReturnType<typeof setInterval>>;
	approached: Set<string>;
	usedFillers: Set<string>;
	lastSpokeAt: number;
	/** current order of the drivers, leader first */
	order: string[];
	worstPositions: Map<string, number>;
	lastOvertakeAt: number;
	pairAnnouncedAt: Map<string, number>;
	/** every line said this race, for the AI's <said> */
	said: string[];
	/** stops the AI's pre-race block when the session ends */
	abort: AbortController;
}

export const createCommentator = ({
	broadcaster,
	drivers,
	createComment,
	getBook = () => null,
	ai,
	random = Math.random,
	now = Date.now,
}: CommentatorDeps): Commentator => {
	const pick = pickWith(random);
	const sessions = new Map<string, RaceSession>();

	/* ---------- Session ---------- */

	const closeSession = (room: Room) => {
		const session = sessions.get(room.channel);
		session?.timers.forEach(timer => clearInterval(timer));
		session?.abort.abort();
		sessions.delete(room.channel);
	};

	const openSession = (room: Room): RaceSession => {
		closeSession(room);
		const session: RaceSession = {
			timers: [],
			approached: new Set(),
			usedFillers: new Set(),
			lastSpokeAt: now(),
			order: [...room.players.keys()],
			worstPositions: new Map(),
			lastOvertakeAt: -Infinity,
			pairAnnouncedAt: new Map(),
			said: [],
			abort: new AbortController(),
		};
		sessions.set(room.channel, session);
		return session;
	};

	/* ---------- Speaking ---------- */

	/** The template comment, with the AI's text instead when there is one */
	const broadcast = <T extends CommentType>(room: Room, type: T, payload: CommentPayloads[T], text?: string | null) => {
		const comment = createComment(type, payload);
		broadcaster.say(room.channel, text ? { ...comment, text } : comment);
		return comment;
	};

	const say = <T extends CommentType>(room: Room, type: T, payload: CommentPayloads[T], text?: string | null) => {
		const session = sessions.get(room.channel);
		if (!session) {
			return; // nobody is on air in this room
		}
		session.lastSpokeAt = now();
		const comment = broadcast(room, type, payload, text);
		session.said.push(text || comment.text);
	};

	/** An AI line, or null on any failure: the AI never breaks the race */
	const aiLine = (room: Room, request: Parameters<AiCommentator['line']>[1]) =>
		ai ? ai.line(room.name, request).catch(() => null) : Promise.resolve(null);

	const statusPayload = (room: Room, session: RaceSession): CommentPayloads['status'] | null => {
		if (room.status !== 'playing' || room.gameStartedAt === null) {
			return null;
		}
		const secondsLeft = getSecondsLeft(room.gameStartedAt, SECONDS_FOR_GAME, now());
		return secondsLeft < MIN_SECONDS_LEFT_FOR_STATUS
			? null
			: { standings: getStandings(room, session.order), textLength: room.textLength, secondsLeft };
	};

	const reportStatus = (room: Room) => {
		const session = sessions.get(room.channel);
		const payload = session && statusPayload(room, session);
		if (!session || !payload) {
			return;
		}
		if (!ai?.has('status')) {
			say(room, 'status', payload);
			return;
		}
		void aiLine(room, {
			slot: 'status',
			data: toStatusPayload(payload),
			said: [...session.said],
			names: [...room.players.keys()],
		}).then(text => {
			// the race may be over by now; a fallback template uses fresh standings
			if (sessions.get(room.channel) !== session) {
				return;
			}
			const fresh = text ? payload : statusPayload(room, session);
			if (fresh) {
				say(room, 'status', fresh, text);
			}
		});
	};

	const fillSilence = (room: Room) => {
		const session = sessions.get(room.channel);
		if (!session || now() - session.lastSpokeAt < FILLER_QUIET_SECONDS * 1000) {
			return;
		}
		const line = pick(getUnused(FILLERS, session.usedFillers));
		session.usedFillers.add(line);
		say(room, 'filler', { line });
	};

	/* ---------- Race moments ---------- */

	const trackOrder = (room: Room, session: RaceSession, username: string, previousTypedChars: number) => {
		const player = room.players.get(username);
		if (!player || room.gameStartedAt === null) {
			return;
		}
		// Who was where before this update and who is where now
		const playersBefore = [...room.players.values()].map(other =>
			other.username === username ? { ...other, typedChars: previousTypedChars, finishTimeMs: null } : other,
		);
		const before = toOrder(rankPlayers(playersBefore, session.order));
		const after = toOrder(rankPlayers([...room.players.values()], session.order));
		session.order = after;

		const isAfterGrace = now() - room.gameStartedAt >= OVERTAKE_GRACE_SECONDS * 1000;
		if (isAfterGrace) {
			session.worstPositions = updateWorstPositions(session.worstPositions, after);
		}

		const position = after.indexOf(username) + 1;
		const overtaken = filterAnnounceableOvertakes(username, findOvertaken(before, after, username), position === 1, {
			now: now(),
			gameStartedAt: room.gameStartedAt,
			lastOvertakeAt: session.lastOvertakeAt,
			pairAnnouncedAt: session.pairAnnouncedAt,
		});
		if (overtaken.length === 0 || player.finishTimeMs !== null) {
			return; // crossing the finish line is announced separately
		}

		say(room, 'overtake', { username, overtaken, position });
		session.lastOvertakeAt = now();
		overtaken.forEach(other => session.pairAnnouncedAt.set(pairKey(username, other), now()));
	};

	const announceFinish = (room: Room, username: string, finishTimeMs: number) => {
		const session = sessions.get(room.channel);
		const standings = getStandings(room, session?.order);
		const finishedCount = standings.filter(standing => standing.finished).length;
		const { wpm } = getSpeed(room.textLength, finishTimeMs);

		say(room, 'finish', {
			username,
			place: finishedCount,
			finishTimeMs,
			isLast: standings.length > 1 && finishedCount === standings.length,
			previous: getPreviousFinisher(standings, username),
			speed: getSpeedNews(drivers.getOrCreate(username), wpm),
		});
	};

	/* ---------- Facade ---------- */

	const raceAnnounced = (room: Room) => {
		const session = openSession(room);
		const usernames = [...room.players.keys()];
		const greeting = { roomName: room.name, weather: pick(WEATHER) };
		const lineup = usernames
			.map(drivers.getOrCreate)
			.map((driver, index, grid) => ({ driver, gridNumber: index + 1, driversCount: grid.length }));
		const rivalry = findRivalry(usernames, drivers.getHeadToHead) ?? null;
		const book = room.textId === null ? null : getBook(room.textId);
		const track = book ? { book } : null;

		// greeting, a line per driver, an old rivalry, today's book: each part with its template.
		// partial application: the room is fixed, only "what to say" changes
		const announce = partial(say, room);
		type Part = [part: string, sayPart: (text: string | null) => void];
		const parts: Part[] = [
			['greeting', text => announce('greeting', greeting, text)],
			...lineup.map((entry): Part => [`driver:${entry.driver.username}`, text => announce('lineup', entry, text)]),
			...(rivalry ? [['rivalry', text => announce('rivalry', rivalry, text)] satisfies Part] : []),
			...(track ? [['track', text => announce('track', track, text)] satisfies Part] : []),
		];

		if (!ai?.has('prerace')) {
			parts.forEach(([, sayPart]) => sayPart(null));
			return;
		}
		const byPart = new Map(parts);
		// the AI says each part as soon as it is ready (or its template at the deadline), in the same order
		void ai
			.prerace(room.name, {
				payload: toPreracePayload({ greeting, lineup, rivalry, track }),
				said: [],
				sayPart: (part, text) => byPart.get(part)?.(text),
				signal: session.abort.signal,
			})
			.catch(error => console.error('[commentator] pre-race AI failed:', error));
	};

	const raceStarted = (room: Room) => {
		const session = sessions.get(room.channel) ?? openSession(room);
		session.order = [...room.players.keys()];
		say(room, 'start', { seconds: SECONDS_FOR_GAME, driversCount: room.players.size });
		session.timers.push(
			setInterval(() => reportStatus(room), STATUS_INTERVAL_SECONDS * 1000),
			setInterval(() => fillSilence(room), FILLER_CHECK_MS),
		);
	};

	const progressUpdated = (room: Room, username: string, previousTypedChars: number) => {
		const session = sessions.get(room.channel);
		const player = room.players.get(username);
		if (!session || !player) {
			return;
		}
		const { textLength } = room;

		trackOrder(room, session, username, previousTypedChars);

		if (isApproachMoment(textLength, previousTypedChars, player.typedChars)) {
			say(room, 'approaching', {
				standings: getStandings(room, session.order),
				username,
				charsLeft: textLength - player.typedChars,
				isFirst: session.approached.size === 0,
			});
			session.approached.add(username);
		}

		if (isFinishMoment(textLength, previousTypedChars, player.typedChars) && player.finishTimeMs !== null) {
			announceFinish(room, username, player.finishTimeMs);
		}
	};

	const driverLeft = (room: Room, username: string) => {
		say(room, 'retired', { username, isRaceRunning: room.status === 'playing' });
	};

	const raceFinished = (room: Room, results: GameResultDto[]) => {
		const session = sessions.get(room.channel);
		if (results.length === 0) {
			closeSession(room);
			return;
		}
		const payload: CommentPayloads['results'] = {
			results,
			// a solo race is not a win (driverRepository.applyResult), so it has no streak to announce
			winnerStreak: results.length >= 2 ? drivers.getOrCreate(results[0].username).winStreak + 1 : 0,
			comeback: session ? findComeback(results, session.worstPositions) : null,
		};
		if (!ai?.has('results') || !session) {
			say(room, 'results', payload);
			drivers.recordResults(results);
			closeSession(room);
			return;
		}
		// the model gets debuts and personal bests from the profiles BEFORE this race is recorded
		const request = {
			slot: 'results' as const,
			data: toResultsPayload(payload, drivers.getOrCreate),
			said: [...session.said],
			names: results.map(result => result.username),
		};
		drivers.recordResults(results);
		closeSession(room);
		// said after the session is closed: at most the results deadline later, AI or template
		void aiLine(room, request).then(text => {
			// a new countdown already started: the results are in the modal, don't talk over the new grid
			if (!sessions.has(room.channel)) {
				broadcast(room, 'results', payload, text);
			}
		});
	};

	return { raceAnnounced, raceStarted, progressUpdated, driverLeft, raceFinished, roomClosed: closeSession };
};

// FACADE: the game knows only these six methods ("the race was announced", "a driver typed something"...).
// Behind them: the comment factory, driver profiles, timers for status reports and jokes,
// race moments detection and the broadcaster (wrapped by the censorship proxy).
import { partial } from 'lodash';
import { SECONDS_FOR_GAME } from '../socket/config';
import {
	FILLER_CHECK_MS,
	FILLER_QUIET_SECONDS,
	MIN_SECONDS_LEFT_FOR_STATUS,
	STATUS_INTERVAL_SECONDS,
} from './config';
import { FILLERS, WEATHER } from './comments/phrases';
import { getUnused, pickWith } from './helpers/random';
import { getSecondsLeft, getStandings, isApproachMoment, isFinishMoment } from './helpers/standings';
import type { CreateComment } from './comments/commentFactory';
import type { DriverRepository } from './drivers/driverRepository';
import type { GameResultDto, Room } from '../socket/types';
import type { Broadcaster, CommentPayloads, CommentType, Random } from './types';

export interface Commentator {
	/** countdown started: greeting + one comment per driver on the grid */
	raceAnnounced: (room: Room) => void;
	/** lights out: start + status reports every 30 s + jokes in the pauses */
	raceStarted: (room: Room) => void;
	/** after every accepted progress update: "30 chars to go" and finish line moments */
	progressUpdated: (room: Room, username: string, previousTypedChars: number) => void;
	/** a driver left during the countdown or the race */
	driverLeft: (room: Room, username: string) => void;
	/** the race is over: podium, driver stats, silence */
	raceFinished: (room: Room, results: GameResultDto[]) => void;
	/** the room is gone: stop all timers */
	roomClosed: (room: Room) => void;
}

interface CommentatorDeps {
	broadcaster: Broadcaster;
	drivers: DriverRepository;
	createComment: CreateComment;
	random?: Random;
	now?: () => number;
}

/** What the commentator remembers during one race in one room */
interface RaceSession {
	timers: Array<ReturnType<typeof setInterval>>;
	approached: Set<string>;
	usedFillers: Set<string>;
	lastSpokeAt: number;
}

export const createCommentator = ({
	broadcaster,
	drivers,
	createComment,
	random = Math.random,
	now = Date.now,
}: CommentatorDeps): Commentator => {
	const pick = pickWith(random);
	const sessions = new Map<string, RaceSession>();

	/* ---------- Session ---------- */

	const closeSession = (room: Room) => {
		sessions.get(room.channel)?.timers.forEach(timer => clearInterval(timer));
		sessions.delete(room.channel);
	};

	const openSession = (room: Room): RaceSession => {
		closeSession(room);
		const session: RaceSession = { timers: [], approached: new Set(), usedFillers: new Set(), lastSpokeAt: now() };
		sessions.set(room.channel, session);
		return session;
	};

	/* ---------- Speaking ---------- */

	const say = <T extends CommentType>(room: Room, type: T, payload: CommentPayloads[T]) => {
		const session = sessions.get(room.channel);
		if (!session) {
			return; // nobody is on air in this room
		}
		session.lastSpokeAt = now();
		broadcaster.say(room.channel, createComment(type, payload));
	};

	const reportStatus = (room: Room) => {
		if (room.status !== 'playing' || room.gameStartedAt === null) {
			return;
		}
		const secondsLeft = getSecondsLeft(room.gameStartedAt, SECONDS_FOR_GAME, now());
		if (secondsLeft < MIN_SECONDS_LEFT_FOR_STATUS) {
			return;
		}
		say(room, 'status', { standings: getStandings(room), textLength: room.textLength, secondsLeft });
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

	/* ---------- Facade ---------- */

	const raceAnnounced = (room: Room) => {
		openSession(room);
		// partial application: the room is fixed, only "what to say" changes
		const announce = partial(say, room);
		announce('greeting', { roomName: room.name, weather: pick(WEATHER) });
		[...room.players.keys()].map(drivers.getOrCreate).forEach((driver, index, grid) =>
			announce('lineup', { driver, gridNumber: index + 1, driversCount: grid.length }),
		);
	};

	const raceStarted = (room: Room) => {
		const session = sessions.get(room.channel) ?? openSession(room);
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

		if (isApproachMoment(textLength, previousTypedChars, player.typedChars)) {
			say(room, 'approaching', {
				standings: getStandings(room),
				username,
				charsLeft: textLength - player.typedChars,
				isFirst: session.approached.size === 0,
			});
			session.approached.add(username);
		}

		if (isFinishMoment(textLength, previousTypedChars, player.typedChars) && player.finishTimeMs !== null) {
			const standings = getStandings(room);
			const finishedCount = standings.filter(standing => standing.finished).length;
			say(room, 'finish', {
				username,
				place: finishedCount,
				finishTimeMs: player.finishTimeMs,
				isLast: standings.length > 1 && finishedCount === standings.length,
			});
		}
	};

	const driverLeft = (room: Room, username: string) => {
		say(room, 'retired', { username, isRaceRunning: room.status === 'playing' });
	};

	const raceFinished = (room: Room, results: GameResultDto[]) => {
		if (results.length > 0) {
			say(room, 'results', { results });
			drivers.recordResults(results);
		}
		closeSession(room);
	};

	return { raceAnnounced, raceStarted, progressUpdated, driverLeft, raceFinished, roomClosed: closeSession };
};

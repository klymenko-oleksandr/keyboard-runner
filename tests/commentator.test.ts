import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILLERS, WEATHER } from '../src/commentator/comments/phrases';
import { createCommentFactory } from '../src/commentator/comments/commentFactory';
import { withCensorship } from '../src/commentator/censorship/censorshipProxy';
import { containsProfanity, maskProfanity } from '../src/commentator/censorship/profanity';
import { createCommentator } from '../src/commentator/commentator';
import {
	applyMeeting,
	applyResult,
	createDriverRepository,
	pairKey,
	toMeetings,
} from '../src/commentator/drivers/driverRepository';
import {
	filterAnnounceableOvertakes,
	findComeback,
	findRivalry,
	getPreviousFinisher,
	getSpeedNews,
	updateWorstPositions,
} from '../src/commentator/helpers/raceMoments';
import {
	findOvertaken,
	getStandings,
	isApproachMoment,
	isFinishMoment,
	rankPlayers,
	toOrder,
} from '../src/commentator/helpers/standings';
import { BOOKS } from '../src/texts/books';
import { characters, formatRaceTime, joinWithOr, races, seconds } from '../src/commentator/helpers/ukrainian';
import type { Broadcaster, CommentDto, CommentPayloads, DriverProfile } from '../src/commentator/types';
import type { GameResultDto, Player, Room } from '../src/socket/types';

/* ---------- Fixtures ---------- */

const player = (username: string, typedChars: number, finishTimeMs: number | null = null): Player => ({
	username,
	ready: true,
	typedChars,
	finishTimeMs,
});

const room = (players: Player[], overrides: Partial<Room> = {}): Room => ({
	name: 'Test room',
	channel: 'room:test room',
	status: 'playing',
	players: new Map(players.map(p => [p.username, p])),
	textId: 0,
	lastTextId: 0,
	textLength: 100,
	gameStartedAt: Date.now(),
	timer: null,
	...overrides,
});

const driver = (username: string, races = 0, wins = 0): DriverProfile => ({
	username,
	car: { brand: 'Ferrari', color: 'червоному', number: 7 },
	races,
	wins,
	bestWpm: 0,
	winStreak: 0,
});

const result = (place: number, username: string, wpm = 40): GameResultDto => ({
	place,
	username,
	finished: true,
	progress: 100,
	finishTimeMs: 30000 + place * 1000,
	wpm,
	charsPerMinute: wpm * 5,
});

const createComment = createCommentFactory({ random: () => 0, now: () => 0 });

const recordingBroadcaster = () => {
	const said: CommentDto[] = [];
	const broadcaster: Broadcaster = { say: (_channel, comment) => said.push(comment) };
	return { said, broadcaster };
};

/* ---------- Ukrainian helpers ---------- */

test('plural forms', () => {
	assert.equal(seconds(1), '1 секунда');
	assert.equal(seconds(3), '3 секунди');
	assert.equal(seconds(11), '11 секунд');
	assert.equal(seconds(21), '21 секунда');
	assert.equal(characters(25), '25 символів');
	assert.equal(races(0), '0 гонок');
});

test('lists and times', () => {
	assert.equal(joinWithOr(['Іван']), 'Іван');
	assert.equal(joinWithOr(['Іван', 'Андрій', 'Олег']), 'Іван, Андрій чи Олег');
	assert.equal(formatRaceTime(23456), '23,5 с');
});

/* ---------- Standings and race moments ---------- */

test('standings: finishers by time, then the rest by typed characters', () => {
	const standings = getStandings(room([player('slow', 10), player('second', 100, 9000), player('fast', 100, 8000), player('mid', 50)]));
	assert.deepEqual(
		standings.map(s => s.username),
		['fast', 'second', 'mid', 'slow'],
	);
});

test('approach and finish moments fire once, on crossing the line', () => {
	assert.equal(isApproachMoment(100, 69, 70), true);
	assert.equal(isApproachMoment(100, 70, 71), false);
	assert.equal(isApproachMoment(100, 69, 100), false); // jumped straight to the finish
	assert.equal(isApproachMoment(20, 0, 1), true); // text shorter than 30 chars
	assert.equal(isFinishMoment(100, 99, 100), true);
	assert.equal(isFinishMoment(100, 100, 100), false);
});

/* ---------- Factory ---------- */

test('factory builds every comment type with clean, polished text', () => {
	const comments = [
		createComment('greeting', { roomName: 'Kyiv', weather: WEATHER[0] }),
		createComment('lineup', { driver: driver('ivan', 3, 1), gridNumber: 1, driversCount: 2 }),
		createComment('lineup', { driver: driver('olena'), gridNumber: 2, driversCount: 2 }),
		createComment('start', { seconds: 60, driversCount: 2 }),
		createComment('status', {
			standings: getStandings(room([player('ivan', 60), player('olena', 48)])),
			textLength: 100,
			secondsLeft: 30,
		}),
		createComment('approaching', {
			standings: getStandings(room([player('ivan', 70), player('olena', 48), player('max', 40)])),
			username: 'ivan',
			charsLeft: 30,
			isFirst: true,
		}),
		createComment('finish', { username: 'ivan', place: 1, finishTimeMs: 41234, isLast: false, previous: null, speed: null }),
		createComment('retired', { username: 'max', isRaceRunning: true }),
		createComment('filler', { line: FILLERS[0] }),
	];

	comments.forEach(comment => {
		assert.ok(comment.text.length > 0, comment.type);
		assert.doesNotMatch(comment.text, /\s{2,}|\s[,.!?]/, comment.text);
	});
	assert.match(comments[1].text, /Під номером 1 — ivan на червоному Ferrari з номером 7 на борту\. На рахунку 3 гонки, із них 1 перемога\./);
	assert.match(comments[2].text, /^Під номером 2 — olena .* Це дебютна гонка!$/);
	assert.match(comments[4].text, /До кінця гонки 30 секунд\. Попереду ivan \(60%\); на другій позиції olena \(48%\), відставання 12 символів\./);
	assert.match(comments[5].text, /Друге місце може дістатися olena чи max/);
	assert.match(comments[6].text, /перше місце! Час: 41,2 с/);
	assert.deepEqual(
		comments.map(c => c.id),
		[1, 2, 3, 4, 5, 6, 7, 8, 9],
	);
});

test('results announce the top three with their times', () => {
	const results: GameResultDto[] = [
		{ place: 1, username: 'ivan', finished: true, progress: 100, finishTimeMs: 40000, wpm: 60, charsPerMinute: 300 },
		{ place: 2, username: 'olena', finished: true, progress: 100, finishTimeMs: 45100, wpm: 53, charsPerMinute: 266 },
		{ place: 3, username: 'max', finished: false, progress: 78, finishTimeMs: null, wpm: 40, charsPerMinute: 200 },
		{ place: 4, username: 'taras', finished: false, progress: 50, finishTimeMs: null, wpm: 30, charsPerMinute: 150 },
	];
	const { text } = createComment('results', { results, winnerStreak: 1, comeback: null });
	assert.match(text, /перше місце — ivan \(40,0 с, 60 WPM\); друге місце — olena \(45,1 с, 53 WPM\); третє місце — max \(78% дистанції/);
	assert.doesNotMatch(text, /taras/);
});

/* ---------- Censorship proxy ---------- */

test('the commentator\'s own phrases are clean', () => {
	[...FILLERS, ...WEATHER, 'До фінішу зовсім небагато', 'потребами'].forEach(line =>
		assert.equal(containsProfanity(line), false, line),
	);
});

test('profanity is masked, normal words are not', () => {
	assert.equal(maskProfanity('xXfuckerXx на старті'), 'x********* на старті');
	assert.equal(maskProfanity('suka_racer'), 's*********');
	assert.equal(maskProfanity('ebay_fan'), 'ebay_fan');
});

test('proxy censors what reaches the real broadcaster and keeps the interface', () => {
	const { said, broadcaster } = recordingBroadcaster();
	const proxied = withCensorship(broadcaster);

	proxied.say('room:x', createComment('finish', { username: 'shithead', place: 1, finishTimeMs: 1000, isLast: false, previous: null, speed: null }));
	proxied.say('room:x', createComment('finish', { username: 'olena', place: 2, finishTimeMs: 2000, isLast: false, previous: null, speed: null }));

	assert.match(said[0].text, /s\*{7}/);
	assert.match(said[1].text, /olena/);
});

/* ---------- Driver profiles ---------- */

test('driver profile is updated immutably after a race', () => {
	const before = driver('ivan', 2, 1);
	const after = applyResult(before, { place: 1, username: 'ivan', finished: true, progress: 100, finishTimeMs: 1, wpm: 70, charsPerMinute: 350 });
	assert.deepEqual([before.races, before.wins], [2, 1]);
	assert.deepEqual([after.races, after.wins, after.bestWpm], [3, 2, 70]);
});

/* ---------- Facade ---------- */

test('facade: a whole race produces the mandatory comments in order', () => {
	const { said, broadcaster } = recordingBroadcaster();
	const drivers = createDriverRepository(() => driver('x').car);
	const commentator = createCommentator({ broadcaster, drivers, createComment, random: () => 0 });

	const ivan = player('ivan', 0);
	const olena = player('olena', 0);
	const race = room([ivan, olena], { status: 'countdown', gameStartedAt: null });

	commentator.raceAnnounced(race);
	race.status = 'playing';
	race.gameStartedAt = Date.now();
	commentator.raceStarted(race);

	ivan.typedChars = 70;
	commentator.progressUpdated(race, 'ivan', 69);
	ivan.typedChars = 100;
	ivan.finishTimeMs = 30000;
	commentator.progressUpdated(race, 'ivan', 70);
	olena.typedChars = 100;
	olena.finishTimeMs = 35000;
	commentator.progressUpdated(race, 'olena', 60); // no approach comment: jumped over the line

	commentator.raceFinished(race, [
		{ place: 1, username: 'ivan', finished: true, progress: 100, finishTimeMs: 30000, wpm: 40, charsPerMinute: 200 },
		{ place: 2, username: 'olena', finished: true, progress: 100, finishTimeMs: 35000, wpm: 34, charsPerMinute: 171 },
	]);

	assert.deepEqual(
		said.map(c => c.type),
		['greeting', 'lineup', 'lineup', 'start', 'approaching', 'finish', 'finish', 'results'],
	);
	assert.match(said[6].text, /Круг завершує olena/);
	assert.equal(drivers.getOrCreate('ivan').wins, 1);

	// the session is closed: later events are ignored, no timers are left running
	commentator.progressUpdated(race, 'ivan', 0);
	assert.equal(said.length, 8);
});

/* ---------- Race moments ---------- */

test('ties keep the previous order; overtakes are found by comparing orders', () => {
	const tied = [player('ivan', 10), player('olena', 10)];
	assert.deepEqual(toOrder(rankPlayers(tied, ['olena', 'ivan'])), ['olena', 'ivan']);
	assert.deepEqual(findOvertaken(['olena', 'ivan', 'max'], ['max', 'olena', 'ivan'], 'max'), ['olena', 'ivan']);
	assert.deepEqual(findOvertaken(['olena', 'ivan'], ['olena', 'ivan'], 'ivan'), []);
	assert.deepEqual(findOvertaken(['olena'], ['olena', 'ghost'], 'ghost'), []);
});

test('overtakes: silent at the start, rate-limited, a new leader always counts', () => {
	const timing = { gameStartedAt: 0, lastOvertakeAt: 10000, pairAnnouncedAt: new Map([[pairKey('ivan', 'olena'), 12000]]) };
	assert.deepEqual(filterAnnounceableOvertakes('ivan', ['olena'], true, { ...timing, now: 3000 }), []); // grace period
	assert.deepEqual(filterAnnounceableOvertakes('max', ['olena'], false, { ...timing, now: 13000 }), []); // cooldown
	assert.deepEqual(filterAnnounceableOvertakes('max', ['olena'], true, { ...timing, now: 13000 }), ['olena']); // new leader
	assert.deepEqual(filterAnnounceableOvertakes('olena', ['ivan', 'max'], true, { ...timing, now: 20000 }), ['max']); // same pair again
});

test('head-to-head: every pair of a race, winner first', () => {
	const results = [result(1, 'ivan'), result(2, 'olena'), result(3, 'max')];
	assert.deepEqual(toMeetings(results), [['ivan', 'olena'], ['ivan', 'max'], ['olena', 'max']]);
	const twice = applyMeeting(applyMeeting(undefined, 'ivan'), 'olena');
	assert.deepEqual(twice, { meetings: 2, wins: { ivan: 1, olena: 1 }, lastWinner: 'olena' });

	const records = new Map([[pairKey('max', 'olena'), applyMeeting(undefined, 'max')], [pairKey('ivan', 'olena'), twice]]);
	const rivalry = findRivalry(['ivan', 'olena', 'max'], (a, b) => records.get(pairKey(a, b)));
	assert.deepEqual(rivalry?.drivers, ['ivan', 'olena']);
	assert.equal(findRivalry(['ivan', 'taras'], () => undefined), null);
});

test('finish line news: previous finisher, debut, personal best', () => {
	const standings = rankPlayers([player('ivan', 100, 30000), player('olena', 100, 30400), player('max', 50)]);
	assert.deepEqual(getPreviousFinisher(standings, 'olena'), { username: 'ivan', gapMs: 400 });
	assert.equal(getPreviousFinisher(standings, 'ivan'), null);

	assert.deepEqual(getSpeedNews(driver('ivan'), 50), { kind: 'debut', wpm: 50 });
	assert.deepEqual(getSpeedNews({ ...driver('ivan', 3), bestWpm: 48 }, 50), { kind: 'personalBest', wpm: 50, previousBest: 48 });
	assert.equal(getSpeedNews({ ...driver('ivan', 3), bestWpm: 60 }, 50), null);
});

test('comeback: biggest climb to the podium, at least two places', () => {
	const results = [result(1, 'max'), result(2, 'ivan'), result(3, 'olena')];
	assert.deepEqual(findComeback(results, new Map([['max', 4], ['ivan', 3]])), { username: 'max', place: 1, worstPosition: 4 });
	assert.equal(findComeback(results, new Map([['max', 2]])), null);
	assert.deepEqual(
		[...updateWorstPositions(new Map([['ivan', 3]]), ['ivan', 'olena']).entries()],
		[['ivan', 3], ['olena', 2]],
	);
});

test('win streak grows with every win and resets otherwise', () => {
	const twoWins = applyResult(applyResult(driver('ivan'), result(1, 'ivan')), result(1, 'ivan'));
	assert.equal(twoWins.winStreak, 2);
	assert.equal(applyResult(twoWins, result(2, 'ivan')).winStreak, 0);
});

test('templates for the new moments', () => {
	const finish = (overrides: Partial<CommentPayloads['finish']>) =>
		createComment('finish', { username: 'olena', place: 2, finishTimeMs: 30400, isLast: false, previous: null, speed: null, ...overrides }).text;

	assert.match(finish({ previous: { username: 'ivan', gapMs: 400 } }), /^Фотофініш! olena перетинає лінію лише на 0,4 с пізніше за ivan: друге місце\.$/);
	assert.doesNotMatch(finish({ previous: { username: 'ivan', gapMs: 2500 } }), /Фотофініш/);
	assert.match(finish({ speed: { kind: 'personalBest', wpm: 61, previousBest: 55 } }), /особистий рекорд: 61 WPM замість 55!/);
	assert.match(finish({ speed: { kind: 'debut', wpm: 40 } }), /Для дебюту дуже непогано: 40 WPM\./);

	assert.match(createComment('overtake', { username: 'max', overtaken: ['ivan'], position: 1 }).text, /max обходить ivan і очолює гонку!/);
	assert.match(createComment('overtake', { username: 'max', overtaken: ['ivan', 'olena'], position: 2 }).text, /max обходить одразу ivan і olena і піднімається на другу позицію\./);

	const rivalry = createComment('rivalry', { drivers: ['ivan', 'olena'], record: { meetings: 3, wins: { ivan: 2, olena: 1 }, lastWinner: 'olena' } });
	assert.match(rivalry.text, /між ними вже 3 зустрічі, рахунок 2:1 на користь ivan\. Минулого разу перемога за olena\./);

	const book = { ...BOOKS[0] };
	assert.match(createComment('track', { book }).text, /«Пригоди Шерлока Холмса», автор Артур Конан Дойл\./);

	const results = createComment('results', {
		results: [result(1, 'max'), result(2, 'ivan')],
		winnerStreak: 3,
		comeback: { username: 'max', worstPosition: 4, place: 1 },
	}).text;
	assert.match(results, /Камбек дня — max: посеред гонки лише четверта позиція, а на фініші перше місце!/);
	assert.match(results, /Вітаємо max: це вже 3 перемоги поспіль!/);
});

test('facade: overtakes, a comeback and, in the next race, a rivalry', () => {
	let clock = 0;
	const { said, broadcaster } = recordingBroadcaster();
	const drivers = createDriverRepository(() => driver('x').car);
	const commentator = createCommentator({ broadcaster, drivers, createComment, random: () => 0, now: () => clock });

	const ivan = player('ivan', 0);
	const olena = player('olena', 0);
	const max = player('max', 0);
	const race = room([ivan, olena, max], { status: 'countdown', gameStartedAt: null, textLength: 200 });
	const type = (who: Player, chars: number) => {
		const previous = who.typedChars;
		who.typedChars = chars;
		commentator.progressUpdated(race, who.username, previous);
	};

	try {
		commentator.raceAnnounced(race);
		race.status = 'playing';
		race.gameStartedAt = 0;
		commentator.raceStarted(race);

		clock = 2000;
		type(olena, 5); // grace period: nobody announces this
		clock = 6000;
		type(ivan, 20); // ivan takes the lead from olena
		type(olena, 21); // ...and they swap back and forth:
		clock = 7000;
		type(ivan, 22); // the same pair is announced once in 15 s
		type(max, 2); // max is last -> worst position 3
		clock = 30000;
		type(max, 40); // max from last to first

		const overtakes = said.filter(c => c.type === 'overtake').map(c => c.text);
		assert.deepEqual(overtakes, ['ivan обходить olena і очолює гонку!', 'max обходить одразу ivan і olena і очолює гонку!']);

		commentator.raceFinished(race, [result(1, 'max'), result(2, 'ivan'), result(3, 'olena')]);
		assert.match(said[said.length - 1].text, /Камбек дня — max: посеред гонки лише третя позиція, а на фініші перше місце!/);

		said.length = 0;
		commentator.raceAnnounced(race);
		assert.deepEqual(said.map(c => c.type), ['greeting', 'lineup', 'lineup', 'lineup', 'rivalry']);
		assert.match(said[2].text, /На рахунку 1 гонка, найкраща швидкість — 40 WPM\./);
	} finally {
		commentator.roomClosed(race); // no timers left behind, even if an assertion fails
	}
});

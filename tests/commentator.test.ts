import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILLERS, WEATHER } from '../src/commentator/comments/phrases';
import { createCommentFactory } from '../src/commentator/comments/commentFactory';
import { withCensorship } from '../src/commentator/censorship/censorshipProxy';
import { containsProfanity, maskProfanity } from '../src/commentator/censorship/profanity';
import { createCommentator } from '../src/commentator/commentator';
import { applyResult, createDriverRepository } from '../src/commentator/drivers/driverRepository';
import { getStandings, isApproachMoment, isFinishMoment } from '../src/commentator/helpers/standings';
import { characters, formatRaceTime, joinWithOr, races, seconds } from '../src/commentator/helpers/ukrainian';
import type { Broadcaster, CommentDto, DriverProfile } from '../src/commentator/types';
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
		createComment('finish', { username: 'ivan', place: 1, finishTimeMs: 41234, isLast: false }),
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
	const { text } = createComment('results', { results });
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

	proxied.say('room:x', createComment('finish', { username: 'shithead', place: 1, finishTimeMs: 1000, isLast: false }));
	proxied.say('room:x', createComment('finish', { username: 'olena', place: 2, finishTimeMs: 2000, isLast: false }));

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

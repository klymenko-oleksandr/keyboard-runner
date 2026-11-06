import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTraceRecorder, textKeyOf } from '../src/traces/traceRecorder';
import { createMemoryTraceRepository } from '../src/traces/traceRepository';
import { applyResult, createDriverRepository } from '../src/commentator/drivers/driverRepository';
import type { DriverSnapshot } from '../src/commentator/drivers/driverRepository';
import type { GameResultDto, Player, Room } from '../src/socket/types';
import type { DriverProfile } from '../src/commentator/types';

const player = (username: string): Player => ({ username, ready: true, typedChars: 0, finishTimeMs: null });

const room = (...usernames: string[]): Room => ({
	name: 'test',
	channel: 'room:test',
	status: 'playing',
	players: new Map(usernames.map(u => [u, player(u)])),
	textId: 1,
	lastTextId: 1,
	textLength: 5,
	gameStartedAt: 0,
	timer: null,
});

const result = (place: number, username: string, finishTimeMs: number | null = 1000, wpm = 60): GameResultDto => ({
	place,
	username,
	finished: finishTimeMs !== null,
	progress: finishTimeMs === null ? 40 : 100,
	finishTimeMs,
	wpm,
	charsPerMinute: wpm * 5,
});

const profile = (username: string, overrides: Partial<DriverProfile> = {}): DriverProfile => ({
	username,
	car: { brand: 'BMW', color: 'синьому', number: 7 },
	races: 0,
	wins: 0,
	bestWpm: 0,
	winStreak: 0,
	...overrides,
});

test('trace recorder: samples in order, one trace per player in results order', () => {
	const recorder = createTraceRecorder();
	const race = room('ann', 'bob');
	recorder.startRace(race, 'hello', { startedAt: Date.UTC(2026, 10, 6) });
	recorder.addSample(race, 'ann', 100.4, 1);
	recorder.addSample(race, 'bob', 150, 1);
	recorder.addSample(race, 'ann', 200, 2);
	recorder.addSample(race, 'ann', 250, 2); // not more characters: ignored
	recorder.addSample(race, 'ann', 300, 5);
	recorder.addSample(race, 'eve', 300, 1); // not in the race: ignored

	const traces = recorder.finishRace(race, [result(1, 'ann', 300), result(2, 'bob', null)]);

	assert.deepEqual(
		traces.map(t => [t.username, t.samples, t.chars, t.finishTimeMs]),
		[
			[
				'ann',
				[
					[100, 1],
					[200, 2],
					[300, 5],
				],
				5,
				300,
			],
			['bob', [[150, 1]], 1, null],
		],
	);
	assert.equal(traces[0].textKey, textKeyOf('hello'));
	assert.equal(traces[0].playersInRace, 2);
	assert.equal(traces[0].startedAt, '2026-11-06T00:00:00.000Z');
	assert.equal(traces[0].vsGhost, false);
	// the session is closed: a second finish gives nothing
	assert.deepEqual(recorder.finishRace(race, [result(1, 'ann')]), []);
});

test('trace recorder: a dropped race leaves nothing behind', () => {
	const recorder = createTraceRecorder();
	const race = room('ann');
	recorder.startRace(race, 'hello', { startedAt: 0 });
	recorder.addSample(race, 'ann', 100, 1);
	recorder.dropRace(race);
	assert.deepEqual(recorder.finishRace(race, [result(1, 'ann')]), []);
});

test('memory trace repository counts attempts per player and text', async () => {
	const repository = createMemoryTraceRepository();
	const recorder = createTraceRecorder();
	const race = room('ann');
	const once = () => {
		recorder.startRace(race, 'hello', { startedAt: 0 });
		return recorder.finishRace(race, [result(1, 'ann')])[0];
	};
	assert.equal((await repository.save(once())).attempt, 1);
	assert.equal((await repository.save(once())).attempt, 2);
	assert.equal((await repository.save({ ...once(), textKey: 'other' })).attempt, 1);
	assert.equal((await repository.save({ ...once(), username: 'bob' })).attempt, 1);
});

test('driver stats: a solo race counts races and best speed, not wins or the streak', () => {
	const before = profile('ann', { races: 3, wins: 2, bestWpm: 50, winStreak: 2 });
	const solo = applyResult(before, result(1, 'ann', 1000, 70), 1);
	assert.deepEqual([solo.races, solo.wins, solo.bestWpm, solo.winStreak], [4, 2, 70, 2]);

	const won = applyResult(before, result(1, 'ann'), 2);
	assert.deepEqual([won.wins, won.winStreak], [3, 3]);
	const lost = applyResult(before, result(2, 'ann'), 3);
	assert.deepEqual([lost.wins, lost.winStreak], [2, 0]);
});

test('driver repository: starts from the stored snapshot and reports every change', () => {
	const saved: DriverSnapshot[] = [];
	const drivers = createDriverRepository(() => profile('x').car, {
		initial: {
			profiles: [profile('ann', { races: 5, wins: 3 })],
			headToHead: [['ann|bob', { meetings: 1, wins: { ann: 1 }, lastWinner: 'ann' }]],
		},
		save: changes => saved.push(changes),
	});
	assert.equal(drivers.getOrCreate('ann').races, 5);
	assert.equal(drivers.getHeadToHead('bob', 'ann')?.meetings, 1);

	drivers.recordResults([result(1, 'bob'), result(2, 'ann')]);
	assert.equal(saved.length, 1);
	assert.deepEqual(
		saved[0].profiles.map(p => [p.username, p.races, p.wins]),
		[
			['bob', 1, 1],
			['ann', 6, 3],
		],
	);
	assert.deepEqual(saved[0].headToHead, [['ann|bob', { meetings: 2, wins: { ann: 1, bob: 1 }, lastWinner: 'bob' }]]);

	// solo race: one profile changes, no rivalry
	drivers.recordResults([result(1, 'ann')]);
	assert.deepEqual(
		saved[1].profiles.map(p => [p.username, p.races, p.wins]),
		[['ann', 7, 3]],
	);
	assert.deepEqual(saved[1].headToHead, []);
});

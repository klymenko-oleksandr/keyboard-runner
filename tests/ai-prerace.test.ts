// Commentator step 4: the pre-race block streamed part by part, and the facade saying it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	createAiCommentator,
	createFakeWriter,
	createPreraceRunner,
	readAiConfig,
	toPreracePayload,
} from '../src/commentator/ai';
import { createCommentFactory } from '../src/commentator/comments/commentFactory';
import { createCommentator } from '../src/commentator/commentator';
import { createDriverRepository } from '../src/commentator/drivers/driverRepository';
import type { ScriptedAnswer, SlotLimits } from '../src/commentator/ai';
import type { Broadcaster, CommentDto, DriverProfile } from '../src/commentator/types';
import type { Player, Room } from '../src/socket/types';

const profile = (username: string): DriverProfile => ({
	username,
	car: { brand: 'Ferrari', color: 'червоному', number: 7 },
	races: 0,
	wins: 0,
	bestWpm: 0,
	winStreak: 0,
});

const payload = toPreracePayload({
	greeting: { roomName: 'Чайка', weather: 'сонячно' },
	lineup: [
		{ driver: profile('duel_ann'), gridNumber: 1, driversCount: 2 },
		{ driver: profile('duel_bob'), gridNumber: 2, driversCount: 2 },
	],
	rivalry: null,
	track: null,
});

const GREETING = 'greeting: Вітаю на «Чайці», сьогодні сонячно!';
const ANN = 'driver:duel_ann: duel_ann стартує першим номером на червоному Ferrari, це дебют!';
const ANN_OK = 'driver:duel_ann: duel_ann на червоному Ferrari з номером 7, це дебют!';
const BOB = 'driver:duel_bob: duel_bob на червоному Ferrari з номером 7, теж дебют!';

/** fast limits so the tests run in milliseconds */
const LIMITS: SlotLimits = { firstLineDeadlineMs: 60, deadlineMs: 150, maxWords: 40, maxTokens: 700 };

const run = async (answer: ScriptedAnswer, signal?: AbortSignal) => {
	const { writer } = createFakeWriter({ prerace: [answer] });
	const said: [string, string | null, number][] = [];
	const started = performance.now();
	const log = await createPreraceRunner(writer)({
		payload,
		said: [],
		sayPart: (part, text) => said.push([part, text, performance.now() - started]),
		signal,
		limits: LIMITS,
	});
	return { said, log };
};

test('pre-race stream: valid parts are said as AI lines, in order', async () => {
	const { said, log } = await run({ text: [GREETING, ANN_OK, BOB].join('\n') });
	assert.deepEqual(
		said.map(([part, text]) => [part, text !== null]),
		[
			['greeting', true],
			['driver:duel_ann', true],
			['driver:duel_bob', true],
		],
	);
	assert.equal(said[0][1], 'Вітаю на «Чайці», сьогодні сонячно!');
	assert.equal(log.outcome, 'ai');
});

test('pre-race stream: a rejected part becomes its template and does not hold back the next one', async () => {
	const { said, log } = await run({ text: [GREETING, ANN, BOB].join('\n'), delayMs: 30 });
	assert.deepEqual(
		said.map(([part, text]) => [part, text !== null]),
		[
			['greeting', true],
			['driver:duel_ann', false],
			['driver:duel_bob', true],
		],
	);
	assert.ok(said[1][2] < LIMITS.deadlineMs, 'the template goes out as soon as the line is rejected');
	assert.equal(log.outcome, 'partial');
	assert.match(log.parts[1].reasons.join(), /gendered: першим/);
	assert.equal(log.parts[1].rejected, ANN.slice('driver:duel_ann: '.length));
});

test('pre-race stream: a slow first line gives way to the template at the first-line deadline', async () => {
	// 3 lines over 600 ms: the greeting arrives at ~200 ms, well after the 60 ms first-line deadline
	const { said, log } = await run({ text: [GREETING, ANN_OK, BOB].join('\n'), delayMs: 600 });
	assert.equal(said[0][1], null);
	assert.ok(said[0][2] >= LIMITS.firstLineDeadlineMs! - 5 && said[0][2] < 200);
	// the rest is past the 150 ms block deadline: templates, and the stream is stopped
	assert.deepEqual(
		said.map(([, text]) => text),
		[null, null, null],
	);
	assert.equal(log.outcome, 'fallback:all');
	assert.equal(log.parts[0].reason, 'missing');
	assert.ok(log.elapsedMs < 400, 'the stream is stopped at the block deadline');
});

test('pre-race stream: missing keys, extra keys and model errors fall back to templates', async () => {
	const missing = await run({ text: [GREETING, 'driver:ghost_rider: ghost_rider на старті!', BOB].join('\n') });
	assert.deepEqual(
		missing.said.map(([part, text]) => [part, text !== null]),
		[
			['greeting', true],
			['driver:duel_ann', false],
			['driver:duel_bob', true],
		],
	);
	assert.deepEqual(missing.log.extraKeys, ['driver:ghost_rider']);

	const broken = await run({ text: '', error: new Error('529 overloaded') });
	assert.deepEqual(
		broken.said.map(([, text]) => text),
		[null, null, null],
	);
	assert.equal(broken.log.error, '529 overloaded');
});

test('pre-race stream: nothing more is said once the session ends', async () => {
	const controller = new AbortController();
	setTimeout(() => controller.abort(), 20);
	const { said } = await run({ text: [GREETING, ANN_OK, BOB].join('\n'), delayMs: 90 }, controller.signal);
	assert.ok(said.length < 3);
});

/* ---------- Facade ---------- */

const player = (username: string): Player => ({ username, ready: true, typedChars: 0, finishTimeMs: null });

test('facade: the pre-race block from the AI, part by part, with templates where it fails', async () => {
	const said: CommentDto[] = [];
	const broadcaster: Broadcaster = { say: (_channel, comment) => said.push(comment) };
	const { writer } = createFakeWriter({ prerace: [{ text: [GREETING, ANN, BOB].join('\n') }] });
	const logged: unknown[] = [];
	const ai = createAiCommentator({
		config: readAiConfig({ AI_COMMENTATOR_ENABLED: 'true', ANTHROPIC_API_KEY: 'k' }),
		writer,
		log: entry => logged.push(entry),
	});
	const commentator = createCommentator({
		broadcaster,
		drivers: createDriverRepository(() => profile('x').car),
		createComment: createCommentFactory({ random: () => 0, now: () => 0 }),
		ai,
		random: () => 0,
	});
	const room: Room = {
		name: 'Чайка',
		channel: 'room:чайка',
		status: 'countdown',
		players: new Map([player('duel_ann'), player('duel_bob')].map(p => [p.username, p])),
		textId: null,
		lastTextId: null,
		textLength: 100,
		gameStartedAt: null,
		timer: null,
	};
	commentator.raceAnnounced(room);
	assert.equal(said.length, 0, 'nothing is said before the model answers');
	await new Promise(resolve => setTimeout(resolve, 20));

	assert.deepEqual(
		said.map(comment => comment.type),
		['greeting', 'lineup', 'lineup'],
	);
	assert.equal(said[0].text, 'Вітаю на «Чайці», сьогодні сонячно!');
	assert.match(said[1].text, /duel_ann/); // the template: the AI line was rejected
	assert.notEqual(said[1].text, ANN.slice('driver:duel_ann: '.length));
	assert.equal(said[2].text, BOB.slice('driver:duel_bob: '.length));
	assert.equal((logged[0] as { slot: string }).slot, 'prerace');
	commentator.roomClosed(room);
});

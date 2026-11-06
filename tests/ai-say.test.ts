// Commentator step 2: sayWithin, the Anthropic writer (with a fake client) and the facade with AI slots.
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import {
	costOf,
	createAiCommentator,
	createAnthropicWriter,
	createFakeWriter,
	createSayWithin,
	preraceParts,
	readAiConfig,
	toParams,
} from '../src/commentator/ai';
import { createCommentFactory } from '../src/commentator/comments/commentFactory';
import { createCommentator } from '../src/commentator/commentator';
import { createDriverRepository } from '../src/commentator/drivers/driverRepository';
import type { AiCommentator, AiLog, MessagesClient, SayWithinRequest } from '../src/commentator/ai';
import type { Broadcaster, CommentDto } from '../src/commentator/types';
import type { GameResultDto, Player, Room } from '../src/socket/types';

const request: SayWithinRequest = {
	slot: 'results',
	data: { results: [{ username: 'duel_ann', wpm: 62 }] },
	said: ['Круг завершує duel_ann!'],
	names: ['duel_ann', 'duel_bob'],
};
const GOOD = 'Перемога за duel_ann: 62 WPM! Дякуємо, до зустрічі на «Чайці»!';
const BAD = 'duel_ann перемогла з 62 WPM!';

/* ---------- sayWithin ---------- */

test('sayWithin: a valid first answer is said', async () => {
	const { writer, calls } = createFakeWriter({ results: [{ text: GOOD }] });
	const line = await createSayWithin(writer)(request);
	assert.equal(line.outcome, 'ai');
	assert.equal(line.text, GOOD);
	assert.equal(line.attempts, 1);
	assert.match(calls[0].user, /<said>\nКруг завершує duel_ann!\n<\/said>/);
	assert.equal(calls[0].maxTokens, 300);
});

test('sayWithin: one retry with the reasons, then the template', async () => {
	const fixed = createFakeWriter({ results: [{ text: BAD }, { text: GOOD }] });
	const line = await createSayWithin(fixed.writer)(request);
	assert.equal(line.outcome, 'ai');
	assert.equal(line.attempts, 2);
	assert.match(line.firstReasons.join(), /past tense: перемогла/);
	assert.deepEqual(fixed.calls[1].previous?.text, BAD);

	const stubborn = createFakeWriter({ results: [{ text: BAD }] });
	const failed = await createSayWithin(stubborn.writer)(request);
	assert.equal(failed.outcome, 'fallback:invalid');
	assert.equal(failed.text, null);
	assert.equal(stubborn.calls.length, 2);
	assert.deepEqual(failed.rejected, [BAD, BAD]);
});

test('sayWithin: a slow model times out, an error falls back', async () => {
	const slow = createFakeWriter({ results: [{ text: GOOD, delayMs: 200 }] });
	const late = await createSayWithin(slow.writer)({ ...request, deadlineMs: 20 });
	assert.equal(late.outcome, 'fallback:timeout');
	assert.equal(late.text, null);

	const broken = createFakeWriter({ results: [{ text: '', error: new Error('529 overloaded') }] });
	const failed = await createSayWithin(broken.writer)(request);
	assert.equal(failed.outcome, 'fallback:error');
	assert.equal(failed.error, '529 overloaded');
});

/* ---------- Anthropic writer ---------- */

const fakeClient = (chunks: string[]) => {
	const seen: { params: unknown; signal?: AbortSignal }[] = [];
	const client: MessagesClient = {
		messages: {
			stream: (params, options) => {
				seen.push({ params, signal: options?.signal });
				const listeners: ((delta: string) => void)[] = [];
				return {
					on: (_event, listener) => listeners.push(listener),
					finalMessage: async () => {
						chunks.forEach(chunk => listeners.forEach(listener => listener(chunk)));
						return { usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 2000 } };
					},
				};
			},
		},
	};
	return { client, seen };
};

test('anthropic writer: thinking off, cached system prompt, retry as a follow-up turn', () => {
	const signal = new AbortController().signal;
	const base = { slot: 'results' as const, system: 'S', user: 'U', maxTokens: 300, signal };
	const params = toParams('claude-haiku-5-5', base);
	assert.deepEqual(params.thinking, { type: 'disabled' });
	assert.deepEqual(params.system, [{ type: 'text', text: 'S', cache_control: { type: 'ephemeral' } }]);
	assert.equal(params.messages.length, 1);
	const retry = toParams('claude-sonnet-5-5', { ...base, previous: { text: 'old', reasons: ['too long'] } });
	assert.equal(retry.thinking, undefined);
	assert.deepEqual(
		retry.messages.map(m => m.role),
		['user', 'assistant', 'user'],
	);
	assert.match(String(retry.messages[2].content), /too long/);
});

test('anthropic writer: streams text, passes the signal, counts the cost', async () => {
	const { client, seen } = fakeClient(['Перемога ', 'за duel_ann! ']);
	let clock = 0;
	const writer = createAnthropicWriter({ model: 'claude-haiku-5-5', client, now: () => (clock += 100) });
	const chunks: string[] = [];
	const signal = new AbortController().signal;
	const result = await writer.write({
		slot: 'results',
		system: 'S',
		user: 'U',
		maxTokens: 300,
		signal,
		onText: chunk => chunks.push(chunk),
	});
	assert.equal(result.text, 'Перемога за duel_ann!');
	assert.deepEqual(chunks, ['Перемога ', 'за duel_ann! ']);
	assert.equal(seen[0].signal, signal);
	assert.equal(result.cacheReadTokens, 2000);
	assert.equal(result.costUsd, costOf({ input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 2000 }));
	assert.ok(Math.abs(result.costUsd - 0.00017) < 1e-12);
});

/* ---------- AI commentator ---------- */

test('ai commentator: only enabled slots, every slot logged', async () => {
	const config = readAiConfig({ AI_COMMENTATOR_ENABLED: 'true', ANTHROPIC_API_KEY: 'k' });
	const logged: Parameters<AiLog>[0][] = [];
	const { writer } = createFakeWriter({ results: [{ text: GOOD }] });
	const ai = createAiCommentator({ config, writer, log: entry => logged.push(entry) });
	assert.equal(ai.has('results'), true);
	assert.equal(ai.has('status'), false);
	assert.equal(await ai.line('Test room', request), GOOD);
	assert.equal(logged[0].type, 'ai-line');
	assert.equal(logged[0].room, 'Test room');
	assert.equal(logged[0].outcome, 'ai');

	const off = createAiCommentator({ config: readAiConfig({}), writer, log: () => {} });
	assert.equal(off.has('results'), false);
});

/* ---------- Facade with AI slots ---------- */

const player = (username: string): Player => ({ username, ready: true, typedChars: 0, finishTimeMs: null });
const room = (...usernames: string[]): Room => ({
	name: 'Test room',
	channel: 'room:test room',
	status: 'countdown',
	players: new Map(usernames.map(u => [u, player(u)])),
	textId: 0,
	lastTextId: 0,
	textLength: 100,
	gameStartedAt: null,
	timer: null,
});
const result = (place: number, username: string, wpm: number): GameResultDto => ({
	place,
	username,
	finished: true,
	progress: 100,
	finishTimeMs: 30000 + place * 1000,
	wpm,
	charsPerMinute: wpm * 5,
});

const setup = (answer: (request: SayWithinRequest) => string | null, slots = ['results']) => {
	const said: CommentDto[] = [];
	const broadcaster: Broadcaster = { say: (_channel, comment) => said.push(comment) };
	const requests: SayWithinRequest[] = [];
	const ai: AiCommentator = {
		has: slot => slots.includes(slot),
		line: async (_room, req) => {
			requests.push(req);
			return answer(req);
		},
		prerace: async (_room, req) => preraceParts(req.payload).forEach(part => req.sayPart(part, null)),
	};
	const drivers = createDriverRepository(() => ({ brand: 'Ferrari', color: 'червоному', number: 7 }));
	const commentator = createCommentator({
		broadcaster,
		drivers,
		createComment: createCommentFactory({ random: () => 0, now: () => 0 }),
		ai,
		random: () => 0,
	});
	return { said, requests, drivers, commentator };
};

const flush = () => new Promise(resolve => setImmediate(resolve));

test('facade: the results line comes from the AI, with data from before the race was recorded', async () => {
	const { said, requests, drivers, commentator } = setup(() => GOOD);
	const race = room('duel_ann', 'duel_bob');
	commentator.raceAnnounced(race);
	commentator.raceFinished(race, [result(1, 'duel_ann', 62), result(2, 'duel_bob', 50)]);
	assert.equal(drivers.getOrCreate('duel_ann').wins, 1); // stats are recorded at once
	await flush();

	const last = said.at(-1);
	assert.equal(last?.type, 'results');
	assert.equal(last?.text, GOOD);
	const data = requests[0].data as { results: { debut: boolean }[] };
	assert.equal(data.results[0].debut, true);
	assert.deepEqual(requests[0].names, ['duel_ann', 'duel_bob']);
	assert.equal(requests[0].said.length, 3); // greeting + two drivers on the grid
});

test('facade: no AI line means the template, and a new countdown silences a late results line', async () => {
	const fallback = setup(() => null);
	const race = room('duel_ann', 'duel_bob');
	fallback.commentator.raceAnnounced(race);
	fallback.commentator.raceFinished(race, [result(1, 'duel_ann', 62), result(2, 'duel_bob', 50)]);
	await flush();
	assert.equal(fallback.said.at(-1)?.type, 'results');
	assert.match(fallback.said.at(-1)?.text ?? '', /duel_ann/);

	const late = setup(() => GOOD);
	late.commentator.raceAnnounced(race);
	late.commentator.raceFinished(race, [result(1, 'duel_ann', 62), result(2, 'duel_bob', 50)]);
	late.commentator.raceAnnounced(race); // players readied up before the AI answered
	await flush();
	assert.equal(late.said.filter(comment => comment.type === 'results').length, 0);
});

test('facade: an AI status line replaces the template; slots that are off stay templates', async () => {
	mock.timers.enable({ apis: ['setInterval', 'Date'] });
	try {
		const { said, requests, commentator } = setup(() => 'duel_ann тримає лідерство!', ['status']);
		const race = room('duel_ann', 'duel_bob');
		commentator.raceAnnounced(race);
		race.status = 'playing';
		race.gameStartedAt = Date.now();
		commentator.raceStarted(race);
		mock.timers.tick(30_000);
		await flush();
		const status = said.filter(comment => comment.type === 'status');
		assert.equal(status.length, 1);
		assert.equal(status[0].text, 'duel_ann тримає лідерство!');
		assert.equal(requests[0].slot, 'status');

		commentator.raceFinished(race, [result(1, 'duel_ann', 62), result(2, 'duel_bob', 50)]);
		assert.equal(said.at(-1)?.type, 'results'); // results is not an AI slot here: said at once
		assert.equal(requests.length, 1);
	} finally {
		mock.timers.reset();
	}
});

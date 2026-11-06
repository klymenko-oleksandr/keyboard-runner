// Commentator step 1: the AI module's pure parts (spec Revision 3). No network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	DEFAULT_MODEL,
	SLOT_LIMITS,
	SYSTEM_PROMPT,
	createFakeWriter,
	parsePartLine,
	planPrerace,
	preraceParts,
	readAiConfig,
	retryMessage,
	toPreracePayload,
	toResultsPayload,
	toStatusPayload,
	userMessage,
	validateLine,
	validatePart,
} from '../src/commentator/ai';
import type { PartArrival, Sleep } from '../src/commentator/ai';
import type { DriverProfile } from '../src/commentator/types';

// ---- validator: cases are real lines from the 3 Nov 2026 bench ----

const context = {
	names: ['duel_ann', 'duel_bob', 'pack_ann', 'pack_dan', 'pack_eve', 'slow_bob', 'slow_cat'],
	numbers: [87, 83, 61, 56, 64, 47, 21, 249],
};
const reasons = (text: string) => validateLine(text, context).reasons.join(' | ');

test('validator: accepts gender-neutral lines in the present tense', () => {
	for (const line of [
		'duel_ann тримає лідерство, а duel_bob дихає в спину, різниця — лише один відсоток!',
		'duel_ann відриває до фінішу: 87% проти 83% у duel_bob, і до фінішу всього 21 секунда!',
		'pack_dan обходить pack_ann і вже дихає в спину лідеру pack_eve!',
		'duel_bob наздоганяє duel_ann! Відрив менше трьох відсотків, до фінішу вісімнадцять секунд!',
		'pack_ann тримає перше місце, але pack_dan уже дихає в спину, відставання всього 4 символи!',
		'Фініш для pack_eve: перше місце і 64 WPM!',
		'Друге місце — у duel_bob, а попереду друга половина дистанції!',
	]) {
		assert.equal(reasons(line), '', line);
	}
});

test('validator: rejects past tense about drivers', () => {
	assert.match(reasons('duel_bob фінішував за 47 секунд!'), /past tense: фінішував/);
	assert.match(reasons('duel_ann майже доїхала, ще трохи до фінішу.'), /past tense: доїхала/);
	assert.match(reasons('Ой, навіть pack_eve не встигла!'), /past tense: встигла/);
	assert.match(reasons('slow_bob зрівнявся з slow_cat!'), /past tense: зрівнявся/);
	assert.match(reasons('duel_ann переміг!'), /past tense: переміг/);
});

test('validator: rejects words that agree with the driver gender', () => {
	assert.match(reasons('duel_bob фінішує першим!'), /gendered: першим/);
	assert.match(reasons('duel_ann фінішує першою!'), /gendered: першою/);
	assert.match(reasons('pack_ann перша, pack_dan друга!'), /gendered: перша, друга/);
	assert.match(reasons('duel_ann теж фінішує! Другий, але з тим самим текстом!'), /gendered: Другий/);
	assert.match(reasons('Чи встигне він наздогнати slow_cat?'), /gendered: він/);
	assert.match(reasons('pack_bob і pack_dan уже дихають їй у спину!'), /gendered: їй/);
});

test('validator: the past tense is fine in sentences about the world, not about a driver', () => {
	assert.equal(reasons("Перша комп'ютерна миша з'явилася ще в шістдесятих. А duel_ann тримає темп!"), '');
	assert.equal(reasons('Роман спершу виходив частинами в газеті, його читав увесь Париж.'), '');
	assert.match(reasons('duel_bob фінішує. Він сьогодні швидкий!'), /gendered: Він/);
	assert.match(reasons('Гонку завершено, а pack_eve не фінішувала.'), /past tense: фінішувала/);
});

test('validator: a pre-race driver line: named, and about that driver throughout', () => {
	const line = (text: string, aboutDriver: string) =>
		validateLine(text, { ...context, allowedLatin: ['Aston', 'Martin'], aboutDriver }).reasons.join(' | ');
	assert.equal(line('duel_ann на зеленому Aston Martin. Це дебют, перемог поки немає.', 'duel_ann'), '');
	assert.match(line('Стартовий номер 1, Aston Martin. Це дебют.', 'duel_ann'), /driver not named: duel_ann/);
	assert.match(line('duel_ann стартує. Перше місце для дебютантки!', 'duel_ann'), /gendered: дебютантки/);
	assert.match(line('duel_bob на старті. Другий на старті!', 'duel_bob'), /gendered: Другий/);
});

test('validator: an ordinal followed by a preposition is about the driver', () => {
	assert.match(reasons('Фініш! duel_ann перша на подіумі з 62 WPM.'), /gendered: перша/);
	assert.equal(reasons('duel_ann на першому місці, друга позиція — у duel_bob.'), '');
});

test('validator: a relative pronoun after a nickname is gendered; суперництво is not a person', () => {
	assert.match(reasons('Друге місце — у duel_ann, яка відстає на 6 символів.'), /gendered: яка/);
	assert.equal(reasons('Суперництво duel_ann і duel_bob триває!'), '');
	assert.equal(reasons('duel_bob на синьому авто, номер якого 87.'), '');
});

test('validator: does not mistake genitive plurals for past tense', () => {
	assert.equal(reasons('duel_bob відстає на 21 відсоток, до фінішу 21 секунда, а символів лишилось мало!'), '');
	assert.equal(reasons('pack_eve наздоганяє лідерів!'), '');
});

test('validator: nicknames must match exactly', () => {
	assert.match(reasons('Slow_bob на 87%!'), /nickname case: Slow_bob/);
	assert.match(reasons('ghost_rider наздоганяє!'), /unknown driver: ghost_rider/);
});

test('validator: numbers: from the data, gaps between them, or 100 - x', () => {
	assert.equal(reasons('duel_ann на 87%, duel_bob відстає на 4 відсотки!'), ''); // 87 - 83
	assert.equal(reasons('duel_ann лишилось 13% тексту!'), ''); // 100 - 87
	// the check is loose on purpose: with many numbers in the data most small gaps pass (87 - 47 - 1 = 39)
	assert.match(reasons('duel_ann лишилось 150 символів!'), /numbers not in data: 150/);
});

test('validator: rejects Latin words, links and long lines', () => {
	assert.match(reasons('duel_ann уже foglас на друге місце!'), /latin: fogl/);
	assert.match(reasons('Дивіться на https://example.com'), /url/);
	assert.match(reasons(Array(30).fill('швидко').join(' ')), /too long/);
	assert.deepEqual(validateLine('  ', context), { ok: false, reasons: ['empty'] });
});

// ---- config ----

test('config: off unless enabled and keyed; MVP slots are pre-race and results', () => {
	assert.equal(readAiConfig({}).enabled, false);
	assert.equal(readAiConfig({ AI_COMMENTATOR_ENABLED: 'true' }).enabled, false);
	assert.equal(readAiConfig({ ANTHROPIC_API_KEY: 'k' }).enabled, false);
	const config = readAiConfig({ AI_COMMENTATOR_ENABLED: 'true', ANTHROPIC_API_KEY: 'k' });
	assert.equal(config.enabled, true);
	assert.deepEqual([...config.slots], ['prerace', 'results']);
	assert.equal(config.model, DEFAULT_MODEL);
});

test('config: AI_COMMENTATOR_SLOTS picks slots and ignores unknown ones', () => {
	const config = readAiConfig({ AI_COMMENTATOR_SLOTS: ' status, prerace ,overtake,', AI_COMMENTATOR_MODEL: 'm' });
	assert.deepEqual([...config.slots], ['status', 'prerace']);
	assert.equal(config.model, 'm');
	assert.deepEqual([...readAiConfig({ AI_COMMENTATOR_SLOTS: '' }).slots], []);
});

// ---- payloads ----

const profile = (username: string, overrides: Partial<DriverProfile> = {}): DriverProfile => ({
	username,
	car: { brand: 'Aston Martin', color: 'зеленому', number: 7 },
	races: 0,
	wins: 0,
	bestWpm: 0,
	winStreak: 0,
	...overrides,
});

const prerace = toPreracePayload({
	greeting: { roomName: 'Чайка', weather: 'сонячно' },
	lineup: [
		{ driver: profile('duel_bob', { races: 4, wins: 2, bestWpm: 61, winStreak: 1 }), gridNumber: 2, driversCount: 2 },
		{ driver: profile('duel_ann'), gridNumber: 1, driversCount: 2 },
	],
	rivalry: {
		drivers: ['duel_ann', 'duel_bob'],
		record: { meetings: 3, wins: { duel_ann: 1, duel_bob: 2 }, lastWinner: 'duel_bob' },
	},
	track: null,
});

test('payloads: pre-race renames that fixed bench errors', () => {
	const [bob, ann] = prerace.drivers;
	assert.deepEqual(
		{ racesBefore: bob.racesBefore, raceNumber: bob.raceNumber, bestWpm: bob.bestWpm, debut: bob.debut },
		{ racesBefore: 4, raceNumber: 5, bestWpm: 61, debut: false },
	);
	assert.equal(ann.bestWpm, null);
	assert.equal(ann.debut, true);
	assert.equal(bob.car.colorLocative, 'зеленому');
	assert.equal(prerace.rivalry?.meetings, 3);
	assert.equal(prerace.track, null);
});

test('payloads: status in percent and chars behind the leader', () => {
	const status = toStatusPayload({
		standings: [
			{ username: 'a', typedChars: 150, finished: false },
			{ username: 'b', typedChars: 120, finished: false },
		],
		textLength: 200,
		secondsLeft: 40,
	} as Parameters<typeof toStatusPayload>[0]);
	assert.deepEqual(
		status.standings.map(s => [s.position, s.percent, s.charsBehindLeader]),
		[
			[1, 75, 0],
			[2, 60, 30],
		],
	);
});

test('payloads: results mark debuts and personal bests from the profile before the race', () => {
	const profiles: Record<string, DriverProfile> = {
		a: profile('a', { races: 3, bestWpm: 50 }),
		b: profile('b'),
		c: profile('c', { races: 2, bestWpm: 70 }),
	};
	const result = (place: number, username: string, wpm: number, finished = true) => ({
		place,
		username,
		finished,
		progress: finished ? 100 : 80,
		finishTimeMs: finished ? 41_250 : null,
		wpm,
		charsPerMinute: wpm * 5,
	});
	const payload = toResultsPayload(
		{ results: [result(1, 'a', 62), result(2, 'b', 40), result(3, 'c', 30, false)], winnerStreak: 2, comeback: null },
		username => profiles[username],
	);
	assert.deepEqual(payload.results[0].personalBest, { previous: 50 });
	assert.equal(payload.results[0].timeSeconds, '41,3');
	assert.equal(payload.results[1].debut, true);
	assert.equal(payload.results[1].personalBest, null);
	assert.equal(payload.results[2].timeSeconds, null);
	assert.equal(payload.everyoneFinished, false);
	assert.equal(payload.winnerWinsInARow, 2);
});

// ---- prompts ----

test('prompts: commentator name and venue, said lines and data in the user message', () => {
	assert.match(SYSTEM_PROMPT, /Таб Шифтович/);
	assert.match(SYSTEM_PROMPT, /Чайка/);
	const message = userMessage('results', { x: 1 }, ['перша', 'друга']);
	assert.match(message, /<said>\nперша\nдруга\n<\/said>/);
	assert.match(message, /<data>\n\{"x":1\}\n<\/data>/);
	assert.match(retryMessage(['past tense: фінішував']), /past tense: фінішував/);
});

// ---- pre-race parts ----

test('pre-race: parts in order — greeting, drivers by grid number, rivalry, track if any', () => {
	assert.deepEqual(preraceParts(prerace), ['greeting', 'driver:duel_ann', 'driver:duel_bob', 'rivalry']);
});

test('pre-race: line parsing tolerates bullets and bold keys', () => {
	assert.deepEqual(parsePartLine('greeting: Вітаю на «Чайці»!'), { part: 'greeting', text: 'Вітаю на «Чайці»!' });
	assert.deepEqual(parsePartLine('- **driver:duel_ann**: duel_ann стартує.'), {
		part: 'driver:duel_ann',
		text: 'duel_ann стартує.',
	});
	assert.equal(parsePartLine('Просто текст без ключа'), null);
	assert.equal(parsePartLine('weather: дощ'), null);
});

test('pre-race: a driver part must name its driver and stay neutral', () => {
	assert.equal(validatePart('driver:duel_ann', 'duel_ann на зеленому Aston Martin, це дебют!', prerace).ok, true);
	assert.match(
		validatePart('driver:duel_ann', 'Дебют на зеленому Aston Martin!', prerace).reasons.join(),
		/driver not named/,
	);
	assert.match(validatePart('driver:duel_bob', 'duel_bob виграв двічі.', prerace).reasons.join(), /past tense/);
});

test('pre-race plan: valid parts are AI, missing / invalid / late ones fall back to templates', () => {
	const parts = preraceParts(prerace);
	const arrivals: PartArrival[] = [
		{ part: 'greeting', text: 'Вітаю на «Чайці», сьогодні сонячно!', atMs: 1100 },
		{ part: 'driver:duel_ann', text: 'Дебют на зеленому Aston Martin!', atMs: 1600 },
		{ part: 'driver:duel_bob', text: 'duel_bob має 2 перемоги і рекорд 61 WPM.', atMs: 2200 },
		{ part: 'driver:duel_bob', text: 'duel_bob — друга версія, ігнорується.', atMs: 2300 },
	];
	const plan = planPrerace(parts, arrivals, prerace);
	assert.deepEqual(
		plan.map(p => [p.part, p.source, p.reason]),
		[
			['greeting', 'ai', 'ok'],
			['driver:duel_ann', 'template', 'invalid'],
			['driver:duel_bob', 'ai', 'ok'],
			['rivalry', 'template', 'missing'],
		],
	);
	assert.equal(plan[2].text, 'duel_bob має 2 перемоги і рекорд 61 WPM.');
	// an invalid part waits for its deadline only in the clock, and later parts never go before earlier ones
	const times = plan.map(p => p.sayAtMs);
	assert.deepEqual(
		times,
		[...times].sort((a, b) => a - b),
	);
	assert.equal(plan[3].sayAtMs, SLOT_LIMITS.prerace.deadlineMs);
});

test('pre-race plan: the first line has its own earlier deadline', () => {
	const plan = planPrerace(['greeting'], [{ part: 'greeting', text: 'Вітаю на «Чайці»!', atMs: 3200 }], prerace);
	assert.equal(plan[0].reason, 'late');
	assert.equal(plan[0].sayAtMs, SLOT_LIMITS.prerace.firstLineDeadlineMs);
});

// ---- fake writer ----

const instantSleep: Sleep = async (_ms, signal) => {
	if (signal.aborted) {
		throw signal.reason;
	}
};

test('fake writer: scripted answers in order, streamed by line, calls recorded', async () => {
	const { writer, calls } = createFakeWriter(
		{ results: [{ text: 'перша' }, { text: 'друга' }], prerace: [{ text: 'greeting: a\ntrack: b', delayMs: 100 }] },
		instantSleep,
	);
	const signal = new AbortController().signal;
	const request = { slot: 'results' as const, system: 's', user: 'u', maxTokens: 10, signal };
	assert.equal((await writer.write(request)).text, 'перша');
	assert.equal((await writer.write(request)).text, 'друга');
	assert.equal((await writer.write(request)).text, 'друга');
	const chunks: string[] = [];
	const result = await writer.write({ ...request, slot: 'prerace', onText: chunk => chunks.push(chunk) });
	assert.deepEqual(chunks, ['greeting: a\n', 'track: b']);
	assert.equal(result.ttftMs, 50);
	assert.equal(calls.length, 4);
	await assert.rejects(writer.write({ ...request, slot: 'status' }), /no answer scripted/);
});

test('fake writer: errors and aborts reject', async () => {
	const { writer } = createFakeWriter({ results: [{ text: '', error: new Error('429') }] }, instantSleep);
	const controller = new AbortController();
	const request = { slot: 'results' as const, system: 's', user: 'u', maxTokens: 10, signal: controller.signal };
	await assert.rejects(writer.write(request), /429/);
	controller.abort(new Error('deadline'));
	await assert.rejects(writer.write(request), /deadline/);
});

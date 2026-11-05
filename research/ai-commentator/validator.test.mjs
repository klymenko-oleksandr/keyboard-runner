// node --test validator.test.mjs — cases are real lines from the 3 Nov 2026 bench
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLine } from './validator.mjs';

const context = {
	names: ['duel_ann', 'duel_bob', 'pack_ann', 'pack_dan', 'pack_eve', 'slow_bob', 'slow_cat'],
	numbers: [87, 83, 61, 56, 64, 47, 21, 249],
};
const reasons = text => validateLine(text, context).reasons.join(' | ');

test('accepts gender-neutral lines in the present tense', () => {
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

test('rejects past tense about drivers', () => {
	assert.match(reasons('duel_bob фінішував за 47 секунд!'), /past tense: фінішував/);
	assert.match(reasons('duel_ann майже доїхала, ще трохи до фінішу.'), /past tense: доїхала/);
	assert.match(reasons('Ой, навіть pack_eve не встигла!'), /past tense: встигла/);
	assert.match(reasons('slow_bob зрівнявся з slow_cat!'), /past tense: зрівнявся/);
	assert.match(reasons('duel_ann переміг!'), /past tense: переміг/);
});

test('rejects words that agree with the driver gender', () => {
	assert.match(reasons('duel_bob фінішує першим!'), /gendered: першим/);
	assert.match(reasons('duel_ann фінішує першою!'), /gendered: першою/);
	assert.match(reasons('pack_ann перша, pack_dan друга!'), /gendered: перша, друга/);
	assert.match(reasons('duel_ann теж фінішує! Другий, але з тим самим текстом!'), /gendered: Другий/);
	assert.match(reasons('Чи встигне він наздогнати slow_cat?'), /gendered: він/);
	assert.match(reasons('pack_bob і pack_dan уже дихають їй у спину!'), /gendered: їй/);
});

test('the past tense is fine in sentences about the world, not about a driver', () => {
	assert.equal(reasons("Перша комп'ютерна миша з'явилася ще в шістдесятих. А duel_ann тримає темп!"), '');
	assert.equal(reasons('Роман спершу виходив частинами в газеті, його читав увесь Париж.'), '');
	assert.match(reasons('duel_bob фінішує. Він сьогодні швидкий!'), /gendered: Він/);
	assert.match(reasons('Гонку завершено, а pack_eve не фінішувала.'), /past tense: фінішувала/);
});

test('a pre-race driver line: named, and about that driver throughout', () => {
	const line = (text, aboutDriver) => validateLine(text, { ...context, allowedLatin: ['Aston', 'Martin'], aboutDriver }).reasons.join(' | ');
	assert.equal(line('duel_ann на зеленому Aston Martin. Це дебют, перемог поки немає.', 'duel_ann'), '');
	assert.match(line('Стартовий номер 1, Aston Martin. Це дебют.', 'duel_ann'), /driver not named: duel_ann/);
	assert.match(line('duel_ann стартує. Перше місце для дебютантки!', 'duel_ann'), /gendered: дебютантки/);
	assert.match(line('duel_bob на старті. Другий на старті!', 'duel_bob'), /gendered: Другий/);
});

test('an ordinal followed by a preposition is about the driver', () => {
	assert.match(reasons('Фініш! duel_ann перша на подіумі з 62 WPM.'), /gendered: перша/);
	assert.equal(reasons('duel_ann на першому місці, друга позиція — у duel_bob.'), '');
});

test('does not mistake genitive plurals for past tense', () => {
	assert.equal(reasons('duel_bob відстає на 21 відсоток, до фінішу 21 секунда, а символів лишилось мало!'), '');
	assert.equal(reasons('pack_eve наздоганяє лідерів!'), '');
});

test('nicknames must match exactly', () => {
	assert.match(reasons('Slow_bob на 87%!'), /nickname case: Slow_bob/);
	assert.match(reasons('ghost_rider наздоганяє!'), /unknown driver: ghost_rider/);
});

test('numbers: from the data, gaps between them, or 100 - x', () => {
	assert.equal(reasons('duel_ann на 87%, duel_bob відстає на 4 відсотки!'), ''); // 87 - 83
	assert.equal(reasons('duel_ann лишилось 13% тексту!'), ''); // 100 - 87
	// the check is loose on purpose: with many numbers in the data most small gaps pass (87 - 47 - 1 = 39)
	assert.match(reasons('duel_ann лишилось 150 символів!'), /numbers not in data: 150/);
});

test('rejects Latin words, links and long lines', () => {
	assert.match(reasons('duel_ann уже foglас на друге місце!'), /latin: fogl/);
	assert.match(reasons('Дивіться на https://example.com'), /url/);
	assert.match(reasons(Array(30).fill('швидко').join(' ')), /too long/);
	assert.deepEqual(validateLine('  ', context), { ok: false, reasons: ['empty'] });
});

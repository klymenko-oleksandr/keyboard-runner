import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBooks } from '../src/texts/bookLibrary';
import { BOOKS } from '../src/texts/books';
import {
	PASSAGE_LENGTH,
	cutPassage,
	hasBalancedQuotes,
	isGoodSentence,
	isProseParagraph,
	normalizeParagraph,
	splitSentences,
} from '../src/texts/passages';
import { createRaceTextService } from '../src/texts/raceTextService';
import type { Book } from '../src/texts/types';

test('Gutenberg typography becomes keyboard-friendly', () => {
	assert.equal(
		normalizeParagraph('"I said--and\n_he_ agreed [Illustration: a boat]."'),
		'"I said - and he agreed ."',
	);
	assert.equal(isProseParagraph('CHAPTER I. THE BEGINNING'), false);
	assert.equal(isProseParagraph('I. A Scandal in Bohemia II. The Red-headed League'), false);
	assert.equal(isProseParagraph('To Sherlock Holmes she is always THE woman. I have seldom heard him mention her.'), true);
});

test('sentences are split, but not after Mr. or an initial', () => {
	assert.deepEqual(splitSentences('Mr. Holmes was late. Jerome K. Jerome wrote it! "Really?" said I.'), [
		'Mr. Holmes was late.',
		'Jerome K. Jerome wrote it!',
		'"Really?" said I.',
	]);
	assert.equal(isGoodSentence('I am here.'), true);
	assert.equal(isGoodSentence('I. A.'), false); // too short to be a sentence
	assert.equal(isGoodSentence('and then he left.'), false); // not a start of a sentence
	assert.equal(isGoodSentence('Café au lait for everyone.'), false); // not on a plain keyboard
});

test('quotes: a passage never starts or ends in the middle of a line of dialogue', () => {
	assert.equal(hasBalancedQuotes(`'Do you know why it's called a whiting?' said Alice.`), true);
	assert.equal(hasBalancedQuotes(`I never knew so much.' 'I can tell you,' said he.`), false);
	assert.equal(hasBalancedQuotes('"Holmes," said I, "look!'), false);
});

test('a passage is whole sentences within the length limits', () => {
	const sentences = ['This is the first sentence of the passage.', 'Here comes another one, a little bit longer.', 'And the third.'];
	const limits = { MIN: 60, MAX: 120 };
	assert.equal(cutPassage(sentences, 0, limits), `${sentences[0]} ${sentences[1]}`);
	assert.equal(cutPassage(sentences, 2, limits), null); // runs out of sentences before MIN
	assert.equal(cutPassage(sentences, 0, { MIN: 60, MAX: 70 }), null); // too long
});

test('every prepared book loads and gives good passages', () => {
	const books = loadBooks();
	assert.equal(books.length, BOOKS.length, 'run `npm run books:prepare`');
	books.forEach(book => {
		const passage = cutPassage(book.sentences, book.sentences.findIndex((_, index) => cutPassage(book.sentences, index)));
		assert.ok(passage, book.info.id);
		assert.ok(passage.length >= PASSAGE_LENGTH.MIN && passage.length <= PASSAGE_LENGTH.MAX);
	});
});

const fakeBook: Book = {
	info: BOOKS[0],
	sentences: [
		'The first sentence of a long and rather detailed passage is here, written only for tests.',
		'The second one continues the story without any surprises, as test sentences usually do.',
	],
};

test('race texts: classic ids stay the same, book passages get new ids', () => {
	let call = 0;
	const sequence = [0.9, 0, 0, 0.1, 0.5]; // book, book #0, sentence #0 | classic, classic #1
	const service = createRaceTextService({
		classicTexts: ['classic zero', 'classic one'],
		books: [fakeBook],
		random: () => sequence[call++ % sequence.length],
	});

	const fromBook = service.pick(null);
	assert.equal(fromBook.id, 2);
	assert.equal(fromBook.book?.id, 'sherlock-holmes');
	assert.equal(service.get(2)?.text, fromBook.text);

	const classic = service.pick(0); // never the same as the previous race
	assert.deepEqual(classic, { id: 1, text: 'classic one', book: null });
	assert.equal(service.get(0)?.text, 'classic zero');
	assert.equal(service.get(99), undefined);
});

test('race texts: without books the classic texts still work', () => {
	const service = createRaceTextService({ classicTexts: ['only one'], books: [], random: () => 0.99 });
	assert.deepEqual(service.pick(0), { id: 0, text: 'only one', book: null });
});

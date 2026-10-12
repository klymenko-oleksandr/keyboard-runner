// Pure functions: from a book paragraph to sentences, from sentences to a race-sized passage.
import type { Random } from './types';

export const PASSAGE_LENGTH = { MIN: 160, MAX: 260 };

/* ---------- Cleaning (used by scripts/prepare-books.ts) ---------- */

/** Gutenberg plain text conventions -> something you can type on a normal keyboard */
export const normalizeParagraph = (paragraph: string) =>
	paragraph
		.replace(/\s*\n\s*/g, ' ')
		.replace(/\[[^\]]*\]/g, '') // [Illustration], [Picture: ...], footnote marks
		.replace(/_/g, '') // _italics_
		.replace(/\s*--\s*/g, ' - ') // em dash
		.replace(/\s+/g, ' ')
		.trim();

/** Drops headings, tables of contents, "THE END", transcriber notes... */
export const isProseParagraph = (paragraph: string) =>
	paragraph.length >= 40 &&
	/[a-z]/.test(paragraph) &&
	/[.!?]["']?$/.test(paragraph) &&
	!/^chapter\b/i.test(paragraph) &&
	!/gutenberg|transcribed|produced by|@/i.test(paragraph);

/* ---------- Sentences ---------- */

const ABBREVIATION = /(?:\b(?:Mr|Mrs|Dr|St|Messrs|Mme|Col|Capt|Gen|Lt|No|Jr|Sr|vs|etc)|\b[A-Z])\.["']?$/;

/** Split after . ! ? (and a closing quote), but not after "Mr." or an initial like "K." */
export const splitSentences = (paragraph: string): string[] =>
	paragraph
		.split(/(?<=[.!?]["']?)\s+(?=["']?[A-Z])/)
		.reduce<string[]>((sentences, piece) => {
			const previous = sentences[sentences.length - 1];
			return previous !== undefined && ABBREVIATION.test(previous)
				? [...sentences.slice(0, -1), `${previous} ${piece}`]
				: [...sentences, piece];
		}, []);

const TYPEABLE = /^[\x20-\x7E]+$/;

export const isGoodSentence = (sentence: string) =>
	TYPEABLE.test(sentence) &&
	/^["']?[A-Z]/.test(sentence) &&
	/[.!?]["']?$/.test(sentence) &&
	sentence.split(' ').length >= 3 &&
	!/[*#\[\]{}<>|\\^~`@]/.test(sentence);

/**
 * Every quote opened in the passage is closed, and nothing is closed that was opened before it
 * (a passage must not start in the middle of someone's line).
 * Opening quote: at the start or after a space/bracket. A single quote between letters (don't) is an apostrophe.
 */
export const hasBalancedQuotes = (text: string) => {
	let depth = 0;
	for (const match of text.matchAll(/["']/g)) {
		const index = match.index ?? 0;
		const before = text[index - 1] ?? ' ';
		const after = text[index + 1] ?? ' ';
		const isOpening = /[\s(]/.test(before);
		const isApostrophe = !isOpening && /[A-Za-z]/.test(before) && /[A-Za-z]/.test(after);
		if (isApostrophe) {
			continue;
		}
		depth += isOpening ? 1 : -1;
		if (depth < 0) {
			return false;
		}
	}
	return depth === 0;
};

/* ---------- Passages ---------- */

/**
 * Takes sentences from `start` while the passage is shorter than MIN.
 * @returns the passage, or null if it can't be made from this start (bad sentence, too long, broken quotes)
 */
export const cutPassage = (sentences: readonly string[], start: number, limits = PASSAGE_LENGTH): string | null => {
	let passage = '';
	for (let index = start; index < sentences.length && passage.length < limits.MIN; index += 1) {
		if (!isGoodSentence(sentences[index])) {
			return null;
		}
		passage = passage ? `${passage} ${sentences[index]}` : sentences[index];
	}
	const fits = passage.length >= limits.MIN && passage.length <= limits.MAX;
	return fits && hasBalancedQuotes(passage) ? passage : null;
};

/** Tries random starting sentences until one gives a good passage */
export const pickPassage = (sentences: readonly string[], random: Random, attempts = 200): string | null => {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		const passage = cutPassage(sentences, Math.floor(random() * sentences.length));
		if (passage) {
			return passage;
		}
	}
	return null;
};

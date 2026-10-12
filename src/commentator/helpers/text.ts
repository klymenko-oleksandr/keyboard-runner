import { flow } from 'lodash';

const collapseSpaces = (text: string) => text.replace(/\s+/g, ' ');
const removeSpaceBeforePunctuation = (text: string) => text.replace(/\s+([,.!?:;])/g, '$1');
const trim = (text: string) => text.trim();

/**
 * Templates are built from pieces, some of them optional, so spaces can double up.
 * One pipeline (function composition) cleans every comment before it is sent.
 * No capitalisation step: a sentence may start with a username, and "olena" must stay "olena".
 */
export const polish: (text: string) => string = flow(
	collapseSpaces,
	removeSpaceBeforePunctuation,
	trim,
);

/** Joins sentences and skips empty ones, so templates can write `condition && 'sentence'` */
export const sentences = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

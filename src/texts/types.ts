import type { BookInfo } from './books';

export type Random = () => number;

export interface RaceText {
	id: number;
	text: string;
	/** null for the classic texts from src/data.ts */
	book: BookInfo | null;
}

export interface Book {
	info: BookInfo;
	/** the whole book as one list of sentences, in order */
	sentences: string[];
}

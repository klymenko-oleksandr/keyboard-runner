// Reads the prepared books from disk once, at startup.
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { BOOKS, type BookInfo } from './books';
import { splitSentences } from './passages';
import type { Book } from './types';

// Same path from src/texts (tsx) and from dist/texts (production build)
export const BOOKS_DIR = path.join(__dirname, '..', '..', 'data', 'books');

const toBook = (info: BookInfo, content: string): Book => ({
	info,
	sentences: content.split('\n').filter(Boolean).flatMap(splitSentences),
});

/** Books whose file is missing are skipped: the game then falls back to the classic texts */
export const loadBooks = (dir = BOOKS_DIR): Book[] =>
	BOOKS.filter(info => existsSync(path.join(dir, `${info.id}.txt`))).map(info =>
		toBook(info, readFileSync(path.join(dir, `${info.id}.txt`), 'utf8')),
	);

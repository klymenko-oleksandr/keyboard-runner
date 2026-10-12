// Downloads the books from the GITenberg mirror of Project Gutenberg and writes data/books/<id>.txt:
// only the book itself (no Gutenberg header, license or tables of contents), one paragraph per line.
//
//   npm run books:prepare
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { BOOKS, type BookInfo } from '../src/texts/books';
import { isProseParagraph, normalizeParagraph } from '../src/texts/passages';

const OUT_DIR = path.join(__dirname, '..', 'data', 'books');
const FILE_NAMES = (id: number) => [`${id}.txt`, `${id}-0.txt`, `${id}-8.txt`];

const download = async ({ mirror, gutenbergId }: BookInfo) => {
	for (const fileName of FILE_NAMES(gutenbergId)) {
		const url = `https://raw.githubusercontent.com/GITenberg/${mirror}_${gutenbergId}/master/${fileName}`;
		const response = await fetch(url);
		if (response.ok) {
			return response.text();
		}
	}
	throw new Error(`Book ${gutenbergId} not found in the mirror`);
};

/** The part between "*** START OF ... ***" and "*** END OF ... ***" */
const getBody = (raw: string) => {
	const lines = raw.replace(/\r\n/g, '\n').split('\n');
	const start = lines.findIndex(line => /^\*\*\* ?START OF/i.test(line));
	const end = lines.findIndex(line => /^\*\*\* ?END OF/i.test(line));
	return lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
};

const toParagraphs = (body: string) => body.split(/\n\s*\n/).map(normalizeParagraph).filter(isProseParagraph);

const prepare = async (book: BookInfo) => {
	const paragraphs = toParagraphs(getBody(await download(book)));
	await writeFile(path.join(OUT_DIR, `${book.id}.txt`), `${paragraphs.join('\n')}\n`);
	console.log(`${book.id}: ${paragraphs.length} paragraphs`);
};

const main = async () => {
	await mkdir(OUT_DIR, { recursive: true });
	for (const book of BOOKS) {
		await prepare(book);
	}
};

main().catch(error => {
	console.error(error);
	process.exit(1);
});

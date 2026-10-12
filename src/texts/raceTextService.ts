// Where race texts come from.
//  - Most races: a random passage cut from one of the books (thousands of possible texts).
//  - Sometimes: one of the classic texts from src/data.ts (the homework requires them to stay there).
// Every text gets an id; the client loads it with GET /game/texts/:id, as before.
import { pickPassage } from './passages';
import type { Book, RaceText, Random } from './types';

/** Share of races that use a classic text from src/data.ts */
export const CLASSIC_TEXT_SHARE = 0.2;
/** Generated texts kept in memory, so GET /game/texts/:id still works for rooms that are racing */
const MAX_STORED_TEXTS = 500;

export interface RaceTextService {
	pick: (previousId: number | null) => RaceText;
	get: (id: number) => RaceText | undefined;
}

interface Deps {
	classicTexts: readonly string[];
	books: readonly Book[];
	random?: Random;
}

export const createRaceTextService = ({ classicTexts, books, random = Math.random }: Deps): RaceTextService => {
	// ids 0..N-1 are the classic texts, so old links and the homework checks keep working
	const classics: RaceText[] = classicTexts.map((text, id) => ({ id, text, book: null }));
	const generated = new Map<number, RaceText>();
	let nextId = classics.length;

	const store = (raceText: Omit<RaceText, 'id'>): RaceText => {
		const stored = { ...raceText, id: nextId };
		nextId += 1;
		generated.set(stored.id, stored);
		if (generated.size > MAX_STORED_TEXTS) {
			generated.delete(generated.keys().next().value as number); // Map keeps insertion order: oldest first
		}
		return stored;
	};

	const pickClassic = (previousId: number | null) => {
		const candidates = classics.length > 1 ? classics.filter(({ id }) => id !== previousId) : classics;
		return candidates[Math.floor(random() * candidates.length)];
	};

	const pickFromBook = (): RaceText | null => {
		if (books.length === 0) {
			return null;
		}
		const book = books[Math.floor(random() * books.length)];
		const passage = pickPassage(book.sentences, random);
		return passage ? store({ text: passage, book: book.info }) : null;
	};

	const pick = (previousId: number | null) =>
		(random() >= CLASSIC_TEXT_SHARE && pickFromBook()) || pickClassic(previousId);

	const get = (id: number) => classics[id] ?? generated.get(id);

	return { pick, get };
};

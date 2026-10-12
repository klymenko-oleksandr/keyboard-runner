import { texts } from '../data';
import { loadBooks } from './bookLibrary';
import { createRaceTextService } from './raceTextService';

export type { RaceText } from './types';
export type { BookInfo } from './books';

export const raceTexts = createRaceTextService({ classicTexts: texts, books: loadBooks() });

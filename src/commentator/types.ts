import type { GameResultDto } from '../socket/types';
import type { BookInfo } from '../texts';

/* ---------- Drivers ---------- */

export interface Car {
	brand: string;
	/** adjective in the locative case: "на <color> <brand>" -> "на червоному Ferrari" */
	color: string;
	number: number;
}

/** What the commentator knows about a driver. Survives between races (in memory). */
export interface DriverProfile {
	username: string;
	car: Car;
	races: number;
	wins: number;
	bestWpm: number;
	/** wins in a row, 0 after any race that was not a win */
	winStreak: number;
}

/** Two drivers who have met before: how many races together and who won them */
export interface HeadToHead {
	meetings: number;
	wins: Record<string, number>;
	lastWinner: string;
}

/** One row of the live standings, leader first */
export interface Standing {
	username: string;
	typedChars: number;
	finished: boolean;
	finishTimeMs: number | null;
}

/* ---------- Comments ---------- */

export type CommentType =
	| 'greeting'
	| 'lineup'
	| 'rivalry'
	| 'track'
	| 'start'
	| 'status'
	| 'overtake'
	| 'approaching'
	| 'finish'
	| 'retired'
	| 'results'
	| 'filler';

/** What travels to the browser */
export interface CommentDto {
	id: number;
	type: CommentType;
	text: string;
	createdAt: number;
}

/** Data every comment type needs. The factory checks at compile time that type and payload match. */
export interface CommentPayloads {
	greeting: { roomName: string; weather: string };
	lineup: { driver: DriverProfile; gridNumber: number; driversCount: number };
	rivalry: { drivers: [string, string]; record: HeadToHead };
	track: { book: BookInfo };
	start: { seconds: number; driversCount: number };
	status: { standings: Standing[]; textLength: number; secondsLeft: number };
	overtake: { username: string; overtaken: string[]; position: number };
	approaching: { standings: Standing[]; username: string; charsLeft: number; isFirst: boolean };
	finish: {
		username: string;
		place: number;
		finishTimeMs: number;
		isLast: boolean;
		/** the driver who crossed the line just before, and by how much */
		previous: { username: string; gapMs: number } | null;
		speed: SpeedNews | null;
	};
	retired: { username: string; isRaceRunning: boolean };
	results: {
		results: GameResultDto[];
		/** the winner's wins in a row, including this one */
		winnerStreak: number;
		comeback: { username: string; worstPosition: number; place: number } | null;
	};
	filler: { line: string };
}

/** Something worth saying about the speed on the finish line */
export type SpeedNews = { kind: 'debut'; wpm: number } | { kind: 'personalBest'; wpm: number; previousBest: number };

export type Random = () => number;

/** Helpers a template may use. Randomness is injected, so templates stay deterministic in tests. */
export interface TemplateTools {
	pick: <T>(items: readonly T[]) => T;
}

export type Template<K extends CommentType> = (payload: CommentPayloads[K], tools: TemplateTools) => string;
export type Templates = { [K in CommentType]: Template<K> };

/** Anything that can deliver a comment to a room */
export interface Broadcaster {
	say: (channel: string, comment: CommentDto) => void;
}

import type { GameResultDto } from '../socket/types';

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
	| 'start'
	| 'status'
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
	start: { seconds: number; driversCount: number };
	status: { standings: Standing[]; textLength: number; secondsLeft: number };
	approaching: { standings: Standing[]; username: string; charsLeft: number; isFirst: boolean };
	finish: { username: string; place: number; finishTimeMs: number; isLast: boolean };
	retired: { username: string; isRaceRunning: boolean };
	results: { results: GameResultDto[] };
	filler: { line: string };
}

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

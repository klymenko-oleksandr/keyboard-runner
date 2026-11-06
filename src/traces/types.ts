/** [ms since lights out, correctly typed characters]: one sample per accepted progress update */
export type ProgressSample = [ms: number, chars: number];

/** One player's whole race: the ghost replays it, and the research logs keep it */
export interface RaceTrace {
	username: string;
	/** the passage itself: generated text ids live only in memory and change after a restart */
	text: string;
	/** sha1 of the text: the stable key for "the same text" */
	textKey: string;
	textLength: number;
	/** 1 = first time this player types this text (repeats are faster, so research uses attempt 1) */
	attempt: number;
	/** ISO time of lights out */
	startedAt: string;
	samples: ProgressSample[];
	/** null = the time ran out */
	finishTimeMs: number | null;
	/** characters typed by the end */
	chars: number;
	wpm: number;
	/** 1 = a solo race */
	playersInRace: number;
	/** this attempt was itself a race against a ghost */
	vsGhost: boolean;
}

/** A trace before the repository knows which attempt it is */
export type NewRaceTrace = Omit<RaceTrace, 'attempt'>;

export interface TraceRepository {
	/** Saves the trace and returns it with its attempt number */
	save: (trace: NewRaceTrace) => Promise<RaceTrace>;
}

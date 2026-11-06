// The pre-race block arrives as keyed lines ("greeting: …", "driver:pack_ann: …", "rivalry: …", "track: …").
// Pure helpers: which parts this race has, which line is which part, and whether it is valid.
// preraceStream.ts says them live.
import { contextFromData, validateLine } from './validator';
import { SLOT_LIMITS } from './config';
import type { PreracePayload } from './payloads';

export type PreracePart = 'greeting' | 'rivalry' | 'track' | `driver:${string}`;

/** The parts in the order they are said: greeting, drivers by grid number, rivalry, track */
export const preraceParts = (payload: PreracePayload): PreracePart[] => [
	'greeting',
	...[...payload.drivers].sort((a, b) => a.gridNumber - b.gridNumber).map(d => `driver:${d.username}` as const),
	...(payload.rivalry ? (['rivalry'] as const) : []),
	...(payload.track ? (['track'] as const) : []),
];

const PART_LINE = /^\s*(greeting|rivalry|track|driver:[A-Za-z0-9_-]+)\s*:\s*(.+)$/;

/** One streamed line -> its part and text, or null. Tolerates "- " bullets and **bold** keys. */
export const parsePartLine = (line: string): { part: PreracePart; text: string } | null => {
	const match = line
		.replace(/\*\*/g, '')
		.replace(/^[\s\-–•]+/, '')
		.match(PART_LINE);
	return match ? { part: match[1] as PreracePart, text: match[2].trim() } : null;
};

/** Validates one part's text; a driver line must name its driver and is checked for gender as a whole */
export const validatePart = (part: PreracePart, text: string, payload: PreracePayload) =>
	validateLine(
		text,
		contextFromData(
			payload,
			payload.drivers.map(d => d.username),
			{
				maxWords: SLOT_LIMITS.prerace.maxWords,
				aboutDriver: part.startsWith('driver:') ? part.slice('driver:'.length) : null,
			},
		),
	);

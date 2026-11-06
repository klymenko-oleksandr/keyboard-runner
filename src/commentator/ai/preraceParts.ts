// The pre-race block arrives as keyed lines ("greeting: …", "driver:pack_ann: …", "rivalry: …", "track: …").
// Pure helpers: which parts this race has, which line is which part, and what gets said when.
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

export interface PartArrival {
	part: PreracePart;
	text: string;
	/** ms after the call started */
	atMs: number;
}

export interface PlannedPart {
	part: PreracePart;
	source: 'ai' | 'template';
	reason: 'ok' | 'missing' | 'invalid' | 'late';
	text: string | null;
	reasons: string[];
	/** when it can be said: a part waits for every part before it */
	sayAtMs: number;
}

/**
 * Arrivals -> what is said, in order. A part is AI if it arrived valid before the deadline, else its template.
 * The first line has its own, earlier deadline: a silent countdown is worse than a template greeting.
 * Pure, so the streaming code in sayWithin stays small and this stays testable.
 */
export const planPrerace = (
	parts: readonly PreracePart[],
	arrivals: readonly PartArrival[],
	payload: PreracePayload,
	limits = SLOT_LIMITS.prerace,
): PlannedPart[] => {
	const firstArrival = new Map<PreracePart, PartArrival>();
	arrivals.forEach(arrival => !firstArrival.has(arrival.part) && firstArrival.set(arrival.part, arrival));
	let clock = 0;
	return parts.map((part, index) => {
		const arrival = firstArrival.get(part);
		const deadline = index === 0 ? (limits.firstLineDeadlineMs ?? limits.deadlineMs) : limits.deadlineMs;
		const reasons = arrival ? validatePart(part, arrival.text, payload).reasons : [];
		const reason: PlannedPart['reason'] = !arrival
			? 'missing'
			: reasons.length
				? 'invalid'
				: arrival.atMs > deadline
					? 'late'
					: 'ok';
		const ok = reason === 'ok';
		clock = Math.max(clock, ok ? (arrival as PartArrival).atMs : deadline);
		return {
			part,
			source: ok ? 'ai' : 'template',
			reason,
			text: ok ? (arrival as PartArrival).text : null,
			reasons,
			sayAtMs: clock,
		};
	});
};

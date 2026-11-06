// The pre-race block, live: one streamed call, each part said as soon as it and every part before it are settled.
// A part is the AI's line if it arrived valid in time, else its template. Rejected parts are not retried:
// a retry would hold back every part after it, and the countdown is only 5 s.
import { SLOT_LIMITS } from './config';
import { SYSTEM_PROMPT, userMessage } from './prompts';
import { parsePartLine, preraceParts, validatePart } from './preraceParts';
import type { SlotLimits } from './config';
import type { LineWriter } from './lineWriter';
import type { PreracePart } from './preraceParts';
import type { PreracePayload } from './payloads';

export interface PreracePartLog {
	part: PreracePart;
	source: 'ai' | 'template';
	reason: 'ok' | 'missing' | 'invalid';
	reasons: string[];
	/** when the AI line arrived (ms from the call), null if it never did */
	arrivedAtMs: number | null;
	saidAtMs: number;
	rejected?: string;
}

export interface PreraceLog {
	slot: 'prerace';
	outcome: 'ai' | 'partial' | 'fallback:all';
	parts: PreracePartLog[];
	extraKeys: string[];
	firstLineMs: number | null;
	ttftMs: number | null;
	elapsedMs: number;
	costUsd: number;
	error?: string;
}

export interface PreraceRequest {
	payload: PreracePayload;
	said: readonly string[];
	/** say this part now: the AI text, or null for the template */
	sayPart: (part: PreracePart, text: string | null) => void;
	/** aborted when the session ends (room closed, a new countdown) */
	signal?: AbortSignal;
	limits?: SlotLimits;
}

export const createPreraceRunner =
	(writer: LineWriter, now: () => number = () => performance.now()) =>
	async ({ payload, said, sayPart, signal, limits = SLOT_LIMITS.prerace }: PreraceRequest): Promise<PreraceLog> => {
		const parts = preraceParts(payload);
		const started = now();
		const elapsed = () => Math.round(now() - started);
		const firstDeadline = limits.firstLineDeadlineMs ?? limits.deadlineMs;
		const deadlineOf = (index: number) => (index === 0 ? firstDeadline : limits.deadlineMs);

		const controller = new AbortController();
		const stop = () => controller.abort(new Error('deadline'));
		signal?.addEventListener('abort', stop);

		const arrivals = new Map<PreracePart, { text: string; atMs: number; reasons: string[] }>();
		const extraKeys: string[] = [];
		const logged: PreracePartLog[] = [];
		let next = 0;
		let ended = false;
		let buffer = '';

		/** say every part that is settled, in order */
		const flush = () => {
			while (next < parts.length && !signal?.aborted) {
				const part = parts[next];
				const arrival = arrivals.get(part);
				if (!arrival && !ended && elapsed() < deadlineOf(next)) {
					return; // still waiting for this one
				}
				const ok = Boolean(arrival && arrival.reasons.length === 0);
				sayPart(part, ok ? (arrival?.text ?? null) : null);
				logged.push({
					part,
					source: ok ? 'ai' : 'template',
					reason: ok ? 'ok' : arrival ? 'invalid' : 'missing',
					reasons: arrival?.reasons ?? [],
					arrivedAtMs: arrival?.atMs ?? null,
					saidAtMs: elapsed(),
					...(arrival && !ok ? { rejected: arrival.text } : {}),
				});
				next += 1;
			}
		};

		const takeLine = (line: string) => {
			const parsed = parsePartLine(line);
			if (!parsed) {
				return;
			}
			const index = parts.indexOf(parsed.part);
			if (index === -1) {
				extraKeys.push(parsed.part);
				return;
			}
			// a part already said (or past its deadline) can no longer change
			if (arrivals.has(parsed.part) || index < next) {
				return;
			}
			const { reasons } = validatePart(parsed.part, parsed.text, payload);
			arrivals.set(parsed.part, { text: parsed.text, atMs: elapsed(), reasons });
			flush();
		};

		const timers = [
			setTimeout(flush, firstDeadline),
			setTimeout(() => {
				ended = true;
				stop();
				flush();
			}, limits.deadlineMs),
		];

		let ttftMs: number | null = null;
		let costUsd = 0;
		let error: string | undefined;
		try {
			const answer = await writer.write({
				slot: 'prerace',
				system: SYSTEM_PROMPT,
				user: userMessage('prerace', payload, said),
				maxTokens: limits.maxTokens,
				signal: controller.signal,
				onText: delta => {
					buffer += delta;
					const lines = buffer.split('\n');
					buffer = lines.pop() ?? '';
					lines.forEach(takeLine);
				},
			});
			ttftMs = answer.ttftMs;
			costUsd = answer.costUsd;
		} catch (caught) {
			if (!controller.signal.aborted) {
				error = caught instanceof Error ? caught.message : String(caught);
			}
		} finally {
			if (!controller.signal.aborted) {
				takeLine(buffer); // the last line ends with the stream
			}
			ended = true;
			flush();
			timers.forEach(clearTimeout);
			signal?.removeEventListener('abort', stop);
		}

		const aiParts = logged.filter(entry => entry.source === 'ai').length;
		return {
			slot: 'prerace',
			outcome: aiParts === 0 ? 'fallback:all' : aiParts === logged.length ? 'ai' : 'partial',
			parts: logged,
			extraKeys,
			firstLineMs: logged[0]?.saidAtMs ?? null,
			ttftMs,
			elapsedMs: elapsed(),
			costUsd,
			...(error ? { error } : {}),
		};
	};

export type PreraceRunner = ReturnType<typeof createPreraceRunner>;

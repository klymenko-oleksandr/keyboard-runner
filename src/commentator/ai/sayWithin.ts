// One AI line within a deadline: write, validate, retry once with the reasons, else give up (the caller says the template).
import { SLOT_LIMITS } from './config';
import { SYSTEM_PROMPT, userMessage } from './prompts';
import { contextFromData, validateLine } from './validator';
import type { AiSlot } from './config';
import type { LineWriter, WriteResult } from './lineWriter';

export interface SayWithinRequest {
	slot: AiSlot;
	/** the model payload (payloads.ts) */
	data: unknown;
	/** lines already said in the room this race */
	said: readonly string[];
	/** drivers the line may name */
	names: readonly string[];
	deadlineMs?: number;
}

export type AiOutcome = 'ai' | 'fallback:invalid' | 'fallback:timeout' | 'fallback:error';

/** What happened to one slot; logged as an `ai-line` */
export interface AiLine {
	slot: AiSlot;
	outcome: AiOutcome;
	/** null: say the template */
	text: string | null;
	attempts: number;
	/** why the first answer was rejected (empty if it was not) */
	firstReasons: string[];
	/** why the last answer was rejected */
	reasons: string[];
	rejected: string[];
	ttftMs: number | null;
	elapsedMs: number;
	costUsd: number;
	error?: string;
}

const isAbort = (error: unknown, signal: AbortSignal) =>
	signal.aborted || (error instanceof Error && /abort/i.test(error.name + error.message));

export const createSayWithin =
	(writer: LineWriter, now: () => number = () => performance.now()) =>
	async ({ slot, data, said, names, deadlineMs = SLOT_LIMITS[slot].deadlineMs }: SayWithinRequest): Promise<AiLine> => {
		const limits = SLOT_LIMITS[slot];
		const context = contextFromData(data, names, { maxWords: limits.maxWords });
		const started = now();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(new Error('deadline')), deadlineMs);

		const line: AiLine = {
			slot,
			outcome: 'fallback:error',
			text: null,
			attempts: 0,
			firstReasons: [],
			reasons: [],
			rejected: [],
			ttftMs: null,
			elapsedMs: 0,
			costUsd: 0,
		};
		const user = userMessage(slot, data, said);
		let previous: { text: string; reasons: string[] } | undefined;

		try {
			while (line.attempts < 2) {
				line.attempts += 1;
				const answer: WriteResult = await writer.write({
					slot,
					system: SYSTEM_PROMPT,
					user,
					maxTokens: limits.maxTokens,
					previous,
					signal: controller.signal,
				});
				line.ttftMs ??= answer.ttftMs;
				line.costUsd += answer.costUsd;
				const { reasons } = validateLine(answer.text, context);
				line.reasons = reasons;
				if (line.attempts === 1) {
					line.firstReasons = reasons;
				}
				if (reasons.length === 0) {
					line.outcome = 'ai';
					line.text = answer.text;
					break;
				}
				line.rejected.push(answer.text);
				line.outcome = 'fallback:invalid';
				previous = { text: answer.text, reasons };
			}
		} catch (error) {
			line.outcome = isAbort(error, controller.signal) ? 'fallback:timeout' : 'fallback:error';
			if (line.outcome === 'fallback:error') {
				line.error = error instanceof Error ? error.message : String(error);
			}
		} finally {
			clearTimeout(timer);
			line.elapsedMs = Math.round(now() - started);
		}
		return line;
	};

export type SayWithin = ReturnType<typeof createSayWithin>;

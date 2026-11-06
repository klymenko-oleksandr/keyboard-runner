// A LineWriter for tests: scripted answers per slot, streamed in chunks, with delays on an injected clock.
import type { AiSlot } from './config';
import type { LineWriter, WriteRequest, WriteResult } from './lineWriter';

export interface ScriptedAnswer {
	text: string;
	/** ms before the answer is complete; chunks are spread evenly over it */
	delayMs?: number;
	/** throw instead of answering (network error, 429, …) */
	error?: Error;
}

export type Sleep = (ms: number, signal: AbortSignal) => Promise<void>;

/** Real-time sleep that rejects when aborted. Tests usually pass a fake one. */
export const realSleep: Sleep = (ms, signal) =>
	new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(signal.reason);
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal.addEventListener('abort', () => {
			clearTimeout(timer);
			reject(signal.reason);
		});
	});

/**
 * Answers come from `script[slot]` in order (first call, then the retry, …); when a slot runs out, the last answer repeats.
 * `calls` records every request, so tests can check prompts and retries.
 */
export const createFakeWriter = (script: Partial<Record<AiSlot, ScriptedAnswer[]>>, sleep: Sleep = realSleep) => {
	const calls: WriteRequest[] = [];
	const used: Partial<Record<AiSlot, number>> = {};

	const write = async (request: WriteRequest): Promise<WriteResult> => {
		calls.push(request);
		const answers = script[request.slot] ?? [];
		const index = Math.min(used[request.slot] ?? 0, answers.length - 1);
		used[request.slot] = (used[request.slot] ?? 0) + 1;
		const answer = answers[index];
		if (!answer) {
			throw new Error(`fakeWriter: no answer scripted for ${request.slot}`);
		}
		const delayMs = answer.delayMs ?? 0;
		const lines = answer.text.split(/(?<=\n)/);
		for (const chunk of lines) {
			await sleep(delayMs / lines.length, request.signal);
			request.onText?.(chunk);
		}
		if (answer.error) {
			throw answer.error;
		}
		return {
			text: answer.text,
			ttftMs: lines.length ? Math.round(delayMs / lines.length) : null,
			totalMs: delayMs,
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			costUsd: 0,
		};
	};

	const writer: LineWriter = { write };
	return { writer, calls };
};

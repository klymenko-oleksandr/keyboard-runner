// The port to the model. The Anthropic implementation comes in step 2; tests use fakeWriter.
import type { AiSlot } from './config';

export interface WriteRequest {
	slot: AiSlot;
	system: string;
	user: string;
	maxTokens: number;
	/** one retry: the rejected answer and why */
	previous?: { text: string; reasons: readonly string[] };
	/** aborted at the slot deadline */
	signal: AbortSignal;
	/** called with every streamed chunk (the pre-race block is said part by part) */
	onText?: (delta: string) => void;
}

export interface WriteResult {
	text: string;
	ttftMs: number | null;
	totalMs: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	costUsd: number;
}

export interface LineWriter {
	write: (request: WriteRequest) => Promise<WriteResult>;
}

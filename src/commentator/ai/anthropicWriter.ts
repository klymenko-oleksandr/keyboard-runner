// The real LineWriter: one streamed Claude call per attempt (spec Revision 3, "Architecture").
import Anthropic from '@anthropic-ai/sdk';
import { retryMessage } from './prompts';
import type { LineWriter, WriteRequest, WriteResult } from './lineWriter';

/** USD per million tokens, Claude Haiku 5.5 (cache writes cost 1.25 × input) */
const PRICE = { input: 0.1, output: 0.5, cacheRead: 0.01 };

interface Usage {
	input_tokens: number;
	output_tokens: number;
	cache_read_input_tokens?: number | null;
	cache_creation_input_tokens?: number | null;
}

/** The part of the SDK client we use, so tests can pass a fake one */
export interface MessagesClient {
	messages: {
		stream: (
			params: Anthropic.MessageStreamParams,
			options?: { signal?: AbortSignal },
		) => {
			on: (event: 'text', listener: (delta: string) => void) => unknown;
			finalMessage: () => Promise<{ usage: Usage }>;
		};
	};
}

export const costOf = (usage: Usage) =>
	((usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) * 1.25) * PRICE.input +
		(usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
		usage.output_tokens * PRICE.output) /
	1e6;

/** Request -> SDK params. The system prompt is cached; Haiku 5.5 thinks by default, which ate max_tokens in the bench. */
export const toParams = (model: string, request: WriteRequest): Anthropic.MessageStreamParams => ({
	model,
	max_tokens: request.maxTokens,
	...(model.startsWith('claude-haiku-5') ? { thinking: { type: 'disabled' as const } } : {}),
	system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
	messages: [
		{ role: 'user', content: request.user },
		...(request.previous
			? [
					{ role: 'assistant' as const, content: request.previous.text },
					{ role: 'user' as const, content: retryMessage(request.previous.reasons) },
				]
			: []),
	],
});

interface AnthropicWriterOptions {
	model: string;
	apiKey?: string;
	client?: MessagesClient;
	now?: () => number;
}

export const createAnthropicWriter = ({
	model,
	apiKey,
	client = new Anthropic({ apiKey, maxRetries: 0 }),
	now = () => performance.now(),
}: AnthropicWriterOptions): LineWriter => ({
	write: async request => {
		const started = now();
		let ttftMs: number | null = null;
		let text = '';
		const stream = client.messages.stream(toParams(model, request), { signal: request.signal });
		stream.on('text', delta => {
			ttftMs ??= Math.round(now() - started);
			text += delta;
			request.onText?.(delta);
		});
		const { usage } = await stream.finalMessage();
		const result: WriteResult = {
			text: text.trim(),
			ttftMs,
			totalMs: Math.round(now() - started),
			inputTokens: usage.input_tokens,
			outputTokens: usage.output_tokens,
			cacheReadTokens: usage.cache_read_input_tokens ?? 0,
			costUsd: costOf(usage),
		};
		return result;
	},
});

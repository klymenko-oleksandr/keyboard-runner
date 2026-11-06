// What the facade sees of the AI: which slots are on, and "give me a line or null". Every slot is logged as `ai-line`.
import { createSayWithin } from './sayWithin';
import type { AiConfig, AiSlot } from './config';
import type { LineWriter } from './lineWriter';
import type { AiLine, SayWithinRequest } from './sayWithin';

export interface AiCommentator {
	has: (slot: AiSlot) => boolean;
	/** an AI line for the slot, or null when the template should be said */
	line: (room: string, request: SayWithinRequest) => Promise<string | null>;
}

export type AiLog = (entry: AiLine & { type: 'ai-line'; room: string; model: string }) => void;

const logToStdout: AiLog = entry => console.log(JSON.stringify(entry));

interface AiCommentatorDeps {
	config: AiConfig;
	writer: LineWriter;
	log?: AiLog;
	now?: () => number;
}

export const createAiCommentator = ({ config, writer, log = logToStdout, now }: AiCommentatorDeps): AiCommentator => {
	const sayWithin = createSayWithin(writer, now);
	return {
		has: slot => config.enabled && config.slots.has(slot),
		line: async (room, request) => {
			const line = await sayWithin(request);
			log({ type: 'ai-line', room, model: config.model, ...line });
			return line.text;
		},
	};
};

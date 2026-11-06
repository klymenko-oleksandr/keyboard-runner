// What the facade sees of the AI: which slots are on, and "give me a line or null". Every slot is logged as `ai-line`.
import { createPreraceRunner } from './preraceStream';
import { createSayWithin } from './sayWithin';
import type { AiConfig, AiSlot } from './config';
import type { LineWriter } from './lineWriter';
import type { PreraceLog, PreraceRequest } from './preraceStream';
import type { AiLine, SayWithinRequest } from './sayWithin';

export interface AiCommentator {
	has: (slot: AiSlot) => boolean;
	/** an AI line for the slot, or null when the template should be said */
	line: (room: string, request: SayWithinRequest) => Promise<string | null>;
	/** the pre-race block, said part by part through request.sayPart; resolves when every part is said */
	prerace: (room: string, request: PreraceRequest) => Promise<void>;
}

export type AiLog = (entry: (AiLine | PreraceLog) & { type: 'ai-line'; room: string; model: string }) => void;

const logToStdout: AiLog = entry => console.log(JSON.stringify(entry));

interface AiCommentatorDeps {
	config: AiConfig;
	writer: LineWriter;
	log?: AiLog;
	now?: () => number;
}

export const createAiCommentator = ({ config, writer, log = logToStdout, now }: AiCommentatorDeps): AiCommentator => {
	const sayWithin = createSayWithin(writer, now);
	const runPrerace = createPreraceRunner(writer, now);
	return {
		has: slot => config.enabled && config.slots.has(slot),
		line: async (room, request) => {
			const line = await sayWithin(request);
			log({ type: 'ai-line', room, model: config.model, ...line });
			return line.text;
		},
		prerace: async (room, request) => {
			const result = await runPrerace(request);
			log({ type: 'ai-line', room, model: config.model, ...result });
		},
	};
};

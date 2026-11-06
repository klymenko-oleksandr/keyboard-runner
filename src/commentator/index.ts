// Composition root: real dependencies are plugged in here, and only here.
import { memoize } from 'lodash';
import { SERVER_EVENTS } from '../socket/events';
import { createCommentFactory } from './comments/commentFactory';
import { withCensorship } from './censorship/censorshipProxy';
import { createCarFactory } from './drivers/carFactory';
import { createDriverRepository } from './drivers/driverRepository';
import { createCommentator } from './commentator';
import { raceTexts } from '../texts';
import { getStorage } from '../storage';
import { createAiCommentator } from './ai/aiCommentator';
import { createAnthropicWriter } from './ai/anthropicWriter';
import { readAiConfig } from './ai/config';
import type { AppServer } from '../socket/types';
import type { Broadcaster } from './types';

export type { Commentator } from './commentator';

const createSocketBroadcaster = (io: AppServer): Broadcaster => ({
	say: (channel, comment) => io.to(channel).emit(SERVER_EVENTS.COMMENT, comment),
});

/** AI lines only with AI_COMMENTATOR_ENABLED=true and a key; otherwise the commentator is all templates */
const createAi = () => {
	const config = readAiConfig(process.env);
	if (!config.enabled) {
		return undefined;
	}
	console.log(`[commentator] AI on: ${[...config.slots].join(', ') || 'no slots'} (${config.model})`);
	return createAiCommentator({
		config,
		writer: createAnthropicWriter({ model: config.model, apiKey: process.env.ANTHROPIC_API_KEY }),
	});
};

/**
 * One commentator per socket.io server. `memoize` caches it by the `io` object,
 * so the game code can call `getCommentator(io)` anywhere without passing it around.
 */
export const getCommentator = memoize((io: AppServer) =>
	createCommentator({
		broadcaster: withCensorship(createSocketBroadcaster(io)),
		// profiles loaded from the database (if any) and written back after every race
		drivers: createDriverRepository(createCarFactory(), getStorage().drivers),
		createComment: createCommentFactory(),
		getBook: textId => raceTexts.get(textId)?.book ?? null,
		ai: createAi(),
	}),
);

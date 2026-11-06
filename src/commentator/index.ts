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
import type { AppServer } from '../socket/types';
import type { Broadcaster } from './types';

export type { Commentator } from './commentator';

const createSocketBroadcaster = (io: AppServer): Broadcaster => ({
	say: (channel, comment) => io.to(channel).emit(SERVER_EVENTS.COMMENT, comment),
});

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
	}),
);

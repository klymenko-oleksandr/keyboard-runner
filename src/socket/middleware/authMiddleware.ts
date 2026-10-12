import type { ExtendedError } from 'socket.io';
import { CONNECTION_ERRORS } from '../events';
import { userRegistry } from '../services/userRegistry';
import { isValidUsername } from '../../helpers/validation';
import type { AppServer, AppSocket } from '../types';

const readHandshakeValue = (socket: AppSocket, key: 'username' | 'sessionId'): unknown => {
	// The starter sends `io('', { query: { username } })`; `auth` is the newer recommended way — support both.
	const fromAuth = socket.handshake.auth?.[key];
	const fromQuery = socket.handshake.query[key];
	return fromAuth ?? (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
};

/**
 * Runs once per connection, BEFORE the `connection` event.
 * Calling next(new Error(...)) rejects the handshake — the client gets `connect_error`
 * with the same message and the socket is never connected.
 *
 * Username rules:
 *  - free username -> OK
 *  - taken by ANOTHER browser tab (different sessionId) -> USERNAME_TAKEN
 *  - taken by the SAME tab (page reload, lost connection) -> it's the same person:
 *    the old socket is disconnected and the new one takes its place
 */
export const createAuthMiddleware =
	(io: AppServer) => (socket: AppSocket, next: (err?: ExtendedError) => void) => {
		const username = readHandshakeValue(socket, 'username');
		const rawSessionId = readHandshakeValue(socket, 'sessionId');
		const sessionId = typeof rawSessionId === 'string' ? rawSessionId : '';

		if (!isValidUsername(username)) {
			return next(new Error(CONNECTION_ERRORS.INVALID_USERNAME));
		}

		const owner = userRegistry.get(username);
		if (owner) {
			if (!sessionId || owner.sessionId !== sessionId) {
				return next(new Error(CONNECTION_ERRORS.USERNAME_TAKEN));
			}
			// Same tab came back before the server noticed the old connection was gone
			io.sockets.sockets.get(owner.socketId)?.disconnect(true);
		}

		// Register right here (not in `connection`) so two simultaneous handshakes with one name can't both pass
		userRegistry.set(username, { sessionId, socketId: socket.id });
		socket.data.username = username;
		socket.data.roomName = null;
		next();
	};

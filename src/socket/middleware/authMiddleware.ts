import type { ExtendedError } from 'socket.io';
import { CONNECTION_ERRORS } from '../events';
import { userRegistry } from '../services/userRegistry';
import { isValidUsername } from '../../helpers/validation';
import type { AppSocket } from '../types';

const readUsername = (socket: AppSocket): unknown => {
	// The starter sends `io('', { query: { username } })`; `auth` is the newer recommended way — support both.
	const fromAuth = socket.handshake.auth?.username;
	const fromQuery = socket.handshake.query.username;
	return fromAuth ?? (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery);
};

/**
 * Runs once per connection, BEFORE the `connection` event.
 * Calling next(new Error(...)) rejects the handshake — the client gets `connect_error`
 * with the same message and the socket is never connected.
 */
export const authMiddleware = (socket: AppSocket, next: (err?: ExtendedError) => void) => {
	const username = readUsername(socket);

	if (!isValidUsername(username)) {
		return next(new Error(CONNECTION_ERRORS.INVALID_USERNAME));
	}
	if (userRegistry.has(username)) {
		return next(new Error(CONNECTION_ERRORS.USERNAME_TAKEN));
	}

	// Register right here (not in `connection`) so two simultaneous handshakes with one name can't both pass
	userRegistry.add(username);
	socket.data.username = username;
	socket.data.roomName = null;
	next();
};

import { LOBBY_CHANNEL, SERVER_EVENTS } from './events';
import { createAuthMiddleware } from './middleware/authMiddleware';
import { userRegistry } from './services/userRegistry';
import { registerRoomHandlers } from './handlers/roomHandlers';
import { registerGameHandlers } from './handlers/gameHandlers';
import { getVisibleRooms } from './game/gameFlow';
import { removePlayerFromRoom } from './game/roomMembership';
import type { AppServer } from './types';

export default (io: AppServer) => {
	io.use(createAuthMiddleware(io));

	io.on('connection', socket => {
		// A fresh connection always starts on the rooms page
		socket.join(LOBBY_CHANNEL);
		socket.emit(SERVER_EVENTS.ROOMS_UPDATED, getVisibleRooms());

		registerRoomHandlers(io, socket);
		registerGameHandlers(io, socket);

		// Closed tab, reload, lost network... Leaving must be handled exactly like "Back to rooms".
		socket.on('disconnect', () => {
			removePlayerFromRoom(io, socket);
			userRegistry.removeIfOwner(socket.data.username, socket.id);
		});
	});
};

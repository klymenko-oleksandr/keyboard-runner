import { CLIENT_EVENTS, SERVER_EVENTS } from '../events';
import { getProgressPercent, isFinished } from '../helpers/roomHelpers';
import { broadcastRoomUsers, tryFinishGame, tryStartCountdown } from '../game/gameFlow';
import { getCurrentRoom } from '../game/roomMembership';
import { getCommentator } from '../../commentator';
import type { AppServer, AppSocket } from '../types';

export const registerGameHandlers = (io: AppServer, socket: AppSocket) => {
	socket.on(CLIENT_EVENTS.SET_READY, rawReady => {
		const room = getCurrentRoom(socket);
		const player = room?.players.get(socket.data.username);

		// "ready" can be changed only before the countdown
		if (!room || !player || room.status !== 'waiting') {
			return;
		}

		const ready = rawReady === true;
		if (player.ready === ready) {
			return; // nothing changed -> nothing to broadcast
		}

		player.ready = ready;
		broadcastRoomUsers(io, room);
		tryStartCountdown(io, room);
	});

	/**
	 * The client checks every key itself and sends only the number of correctly typed characters.
	 * The server just validates that the number makes sense.
	 */
	socket.on(CLIENT_EVENTS.UPDATE_PROGRESS, rawTypedChars => {
		const room = getCurrentRoom(socket);
		const player = room?.players.get(socket.data.username);

		if (!room || !player || room.status !== 'playing' || isFinished(player)) {
			return;
		}

		const typedChars = Number(rawTypedChars);
		const isValid =
			Number.isInteger(typedChars) && typedChars > player.typedChars && typedChars <= room.textLength;
		if (!isValid) {
			return;
		}

		const previousTypedChars = player.typedChars;
		player.typedChars = typedChars;
		if (typedChars === room.textLength) {
			player.finishTimeMs = Date.now() - (room.gameStartedAt as number);
		}

		io.to(room.channel).emit(SERVER_EVENTS.PROGRESS_UPDATED, {
			username: player.username,
			progress: getProgressPercent(player, room),
			finished: isFinished(player),
		});
		getCommentator(io).progressUpdated(room, player.username, previousTypedChars);

		tryFinishGame(io, room);
	});
};

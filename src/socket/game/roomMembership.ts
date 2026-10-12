import { LOBBY_CHANNEL, SERVER_EVENTS } from '../events';
import { roomRepository } from '../services/roomRepository';
import { createPlayer, toPlayerDtos, toRoomDetailsDto } from '../helpers/roomHelpers';
import { getCommentator } from '../../commentator';
import {
	broadcastRooms,
	broadcastRoomUsers,
	destroyRoom,
	getVisibleRooms,
	tryFinishGame,
	tryStartCountdown,
} from './gameFlow';
import type { AppServer, AppSocket, Room, RoomDetailsDto } from '../types';

export const getCurrentRoom = (socket: AppSocket): Room | undefined =>
	socket.data.roomName ? roomRepository.get(socket.data.roomName) : undefined;

/**
 * @returns room details for the joined user (sent back in the acknowledgement)
 */
export const addPlayerToRoom = (io: AppServer, socket: AppSocket, room: Room): RoomDetailsDto => {
	room.players.set(socket.data.username, createPlayer(socket.data.username));
	socket.data.roomName = room.name;

	socket.leave(LOBBY_CHANNEL); // stop receiving the rooms list while inside a room
	socket.join(room.channel);

	// Others in the room get the new list; the joined user gets it in the ack — no duplicate event
	socket.to(room.channel).emit(SERVER_EVENTS.ROOM_USERS_UPDATED, toPlayerDtos(room));
	broadcastRooms(io); // number of users changed (or the room is full now and hidden)

	return toRoomDetailsDto(room);
};

/**
 * Used by both "Back to rooms" and `disconnect`.
 * Leaving can change the state of the remaining players:
 *  - the one who was NOT ready left -> everyone left is ready -> start the countdown
 *  - the one who was still typing left -> everyone left has finished -> finish the game
 */
export const removePlayerFromRoom = (io: AppServer, socket: AppSocket) => {
	const room = getCurrentRoom(socket);
	socket.data.roomName = null;

	if (!room) {
		return;
	}

	room.players.delete(socket.data.username);
	socket.leave(room.channel);
	socket.join(LOBBY_CHANNEL); // back on the rooms page -> receives the list below

	if (room.players.size === 0) {
		destroyRoom(io, room);
		broadcastRooms(io);
		return;
	}

	broadcastRoomUsers(io, room);

	if (room.status !== 'waiting') {
		getCommentator(io).driverLeft(room, socket.data.username);
	}

	// Both transitions broadcast the rooms list themselves
	const stateChanged = tryStartCountdown(io, room) || tryFinishGame(io, room);

	if (stateChanged) {
		return;
	}
	if (room.status === 'waiting') {
		broadcastRooms(io); // users counter changed for everyone in the lobby
	} else {
		// the room is hidden anyway (countdown / game) -> the list did not change for others,
		// only the user who just came back to the lobby needs it
		socket.emit(SERVER_EVENTS.ROOMS_UPDATED, getVisibleRooms());
	}
};

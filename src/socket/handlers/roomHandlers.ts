import { CLIENT_EVENTS } from '../events';
import { MAXIMUM_USERS_FOR_ONE_ROOM } from '../config';
import { roomRepository } from '../services/roomRepository';
import { isFull } from '../helpers/roomHelpers';
import { fail, ok, safeAck } from '../helpers/ack';
import { addPlayerToRoom, removePlayerFromRoom } from '../game/roomMembership';
import { normalizeRoomName, ROOM_NAME_MAX_LENGTH } from '../../helpers/validation';
import type { AppServer, AppSocket, RoomDetailsDto } from '../types';

export const registerRoomHandlers = (io: AppServer, socket: AppSocket) => {
	socket.on(CLIENT_EVENTS.CREATE_ROOM, (rawName, rawAck) => {
		const ack = safeAck<RoomDetailsDto>(rawAck);
		const name = normalizeRoomName(rawName);

		if (!name) {
			return ack(fail(`Room name must be 1-${ROOM_NAME_MAX_LENGTH} characters long`));
		}
		if (socket.data.roomName) {
			return ack(fail('You are already in a room'));
		}
		if (roomRepository.has(name)) {
			return ack(fail(`Room "${name}" already exists`));
		}

		const room = roomRepository.create(name);
		// creator is joined automatically
		ack(ok(addPlayerToRoom(io, socket, room)));
	});

	socket.on(CLIENT_EVENTS.JOIN_ROOM, (rawName, rawAck) => {
		const ack = safeAck<RoomDetailsDto>(rawAck);
		const room = typeof rawName === 'string' ? roomRepository.get(rawName) : undefined;

		if (!room) {
			return ack(fail('Room not found'));
		}
		if (socket.data.roomName) {
			return ack(fail('You are already in a room'));
		}
		if (isFull(room)) {
			return ack(fail(`Room is full (max ${MAXIMUM_USERS_FOR_ONE_ROOM} users)`));
		}
		if (room.status !== 'waiting') {
			return ack(fail('The race in this room has already started'));
		}

		ack(ok(addPlayerToRoom(io, socket, room)));
	});

	socket.on(CLIENT_EVENTS.LEAVE_ROOM, rawAck => {
		removePlayerFromRoom(io, socket);
		safeAck<null>(rawAck)(ok(null));
	});
};

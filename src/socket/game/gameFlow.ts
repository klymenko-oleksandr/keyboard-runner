// Room lifecycle (a small state machine):
//
//   waiting --(everyone ready)--> countdown --(timer)--> playing --(all finished | time is up)--> waiting
//
// Every state transition lives here, together with the broadcasts it causes.
import { SECONDS_FOR_GAME, SECONDS_TIMER_BEFORE_START_GAME, START_LIGHTS_HOLD_MS } from '../config';
import { LOBBY_CHANNEL, SERVER_EVENTS } from '../events';
import { roomRepository } from '../services/roomRepository';
import { texts } from '../../data';
import {
	areAllFinished,
	areAllReady,
	buildResults,
	isJoinable,
	pickRandomTextId,
	resetPlayersForNextRace,
	toPlayerDtos,
	toRoomSummaryDto,
} from '../helpers/roomHelpers';
import type { AppServer, Room } from '../types';

const clearRoomTimer = (room: Room) => {
	if (room.timer) {
		clearTimeout(room.timer);
		room.timer = null;
	}
};

/* ---------- Broadcasts ---------- */

export const getVisibleRooms = () => roomRepository.getAll().filter(isJoinable).map(toRoomSummaryDto);

/** Only users on the rooms page (the lobby channel) receive the list */
export const broadcastRooms = (io: AppServer) => {
	io.to(LOBBY_CHANNEL).emit(SERVER_EVENTS.ROOMS_UPDATED, getVisibleRooms());
};

export const broadcastRoomUsers = (io: AppServer, room: Room) => {
	io.to(room.channel).emit(SERVER_EVENTS.ROOM_USERS_UPDATED, toPlayerDtos(room));
};

/* ---------- Transitions ---------- */

/**
 * waiting -> countdown. Called after "ready" changes AND after someone leaves the room.
 * @returns true if the countdown has started
 */
export const tryStartCountdown = (io: AppServer, room: Room): boolean => {
	if (room.status !== 'waiting' || !areAllReady(room)) {
		return false;
	}

	const textId = pickRandomTextId(room.lastTextId);
	room.status = 'countdown';
	room.textId = textId;
	room.lastTextId = textId;
	room.textLength = texts[textId].length;

	// The client receives only the id and loads the text itself: GET /game/texts/:id
	io.to(room.channel).emit(SERVER_EVENTS.COUNTDOWN_STARTED, {
		textId,
		seconds: SECONDS_TIMER_BEFORE_START_GAME,
	});
	broadcastRooms(io); // the room disappears from the list

	// The client shows the countdown; the extra random hold is known only to the server
	const holdMs = START_LIGHTS_HOLD_MS.MIN + Math.random() * (START_LIGHTS_HOLD_MS.MAX - START_LIGHTS_HOLD_MS.MIN);
	room.timer = setTimeout(() => startGame(io, room), SECONDS_TIMER_BEFORE_START_GAME * 1000 + holdMs);
	return true;
};

/** countdown -> playing */
const startGame = (io: AppServer, room: Room) => {
	room.status = 'playing';
	room.gameStartedAt = Date.now();

	io.to(room.channel).emit(SERVER_EVENTS.GAME_STARTED, { seconds: SECONDS_FOR_GAME });

	room.timer = setTimeout(() => finishGame(io, room), SECONDS_FOR_GAME * 1000);
};

/**
 * playing -> waiting, when everyone has finished. Called after progress updates AND after someone leaves.
 * @returns true if the game has finished
 */
export const tryFinishGame = (io: AppServer, room: Room): boolean => {
	if (room.status !== 'playing' || !areAllFinished(room)) {
		return false;
	}
	finishGame(io, room);
	return true;
};

/** playing -> waiting (all finished or time is up) */
const finishGame = (io: AppServer, room: Room) => {
	clearRoomTimer(room);

	const results = buildResults(room, Date.now());

	room.status = 'waiting';
	room.textId = null;
	room.textLength = 0;
	room.gameStartedAt = null;
	resetPlayersForNextRace(room);

	io.to(room.channel).emit(SERVER_EVENTS.GAME_FINISHED, { results });
	broadcastRoomUsers(io, room); // everyone is "not ready" again
	broadcastRooms(io); // the room is visible in the list again (if not full)
};

/** Last user left: stop timers and forget the room */
export const destroyRoom = (room: Room) => {
	clearRoomTimer(room);
	roomRepository.delete(room.name);
};

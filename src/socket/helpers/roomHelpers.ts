// Pure functions over a Room: no sockets, no timers. Easy to read and to unit-test.
import { MAXIMUM_USERS_FOR_ONE_ROOM } from '../config';
import { texts } from '../../data';
import type { GameResultDto, Player, PlayerDto, Room, RoomDetailsDto, RoomSummaryDto } from '../types';

export const createPlayer = (username: string): Player => ({
	username,
	ready: false,
	typedChars: 0,
	finishTimeMs: null,
});

export const isFull = (room: Room) => room.players.size >= MAXIMUM_USERS_FOR_ONE_ROOM;

/** Rooms list shows only rooms you can actually join */
export const isJoinable = (room: Room) => room.status === 'waiting' && !isFull(room);

export const isFinished = (player: Player) => player.finishTimeMs !== null;

export const areAllReady = (room: Room) =>
	room.players.size > 0 && [...room.players.values()].every(player => player.ready);

export const areAllFinished = (room: Room) =>
	room.players.size > 0 && [...room.players.values()].every(isFinished);

export const getProgressPercent = (player: Player, room: Room) => {
	if (isFinished(player)) {
		return 100;
	}
	if (room.textLength === 0) {
		return 0;
	}
	return Math.floor((player.typedChars / room.textLength) * 100);
};

/** Next text is random, but never the same as the previous race in this room */
export const pickRandomTextId = (previousId: number | null) => {
	if (texts.length === 1) {
		return 0;
	}
	let id: number;
	do {
		id = Math.floor(Math.random() * texts.length);
	} while (id === previousId);
	return id;
};

/** Typing speed: chars per minute, and WPM where every 5 characters count as one word */
export const getSpeed = (chars: number, ms: number) => {
	const charsPerMinute = ms > 0 ? Math.round((chars * 60000) / ms) : 0;
	return { charsPerMinute, wpm: Math.round(charsPerMinute / 5) };
};

/**
 * 1) everyone who finished — by finish time
 * 2) everyone else — by typed characters (more = better)
 * Players who left the room are already removed from `room.players`, so they are not in the results.
 */
export const buildResults = (room: Room, now: number): GameResultDto[] => {
	const players = [...room.players.values()];
	const elapsedMs = room.gameStartedAt ? now - room.gameStartedAt : 0;

	const finished = players
		.filter(isFinished)
		.sort((a, b) => (a.finishTimeMs as number) - (b.finishTimeMs as number));
	const unfinished = players.filter(player => !isFinished(player)).sort((a, b) => b.typedChars - a.typedChars);

	return [...finished, ...unfinished].map((player, index) => {
		const done = isFinished(player);
		const speed = done
			? getSpeed(room.textLength, player.finishTimeMs as number)
			: getSpeed(player.typedChars, elapsedMs);

		return {
			place: index + 1,
			username: player.username,
			finished: done,
			progress: getProgressPercent(player, room),
			finishTimeMs: player.finishTimeMs,
			...speed,
		};
	});
};

export const resetPlayersForNextRace = (room: Room) => {
	room.players.forEach(player => {
		player.ready = false;
		player.typedChars = 0;
		player.finishTimeMs = null;
	});
};

/* ---------- Mappers to DTO ---------- */

export const toRoomSummaryDto = (room: Room): RoomSummaryDto => ({
	name: room.name,
	numberOfUsers: room.players.size,
});

export const toPlayerDtos = (room: Room): PlayerDto[] =>
	[...room.players.values()].map(player => ({
		username: player.username,
		ready: player.ready,
		progress: getProgressPercent(player, room),
		finished: isFinished(player),
	}));

export const toRoomDetailsDto = (room: Room): RoomDetailsDto => ({
	name: room.name,
	users: toPlayerDtos(room),
});

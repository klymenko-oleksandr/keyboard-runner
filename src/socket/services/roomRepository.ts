import type { Room } from '../types';

// In-memory storage. Lives inside one Node.js process: restart = all rooms are gone,
// and two server instances would NOT see each other's rooms.
const rooms = new Map<string, Room>();

// "Room A" and "room a" are treated as the same room
const toKey = (name: string) => name.toLowerCase();

export const roomRepository = {
	get: (name: string) => rooms.get(toKey(name)),

	has: (name: string) => rooms.has(toKey(name)),

	getAll: () => [...rooms.values()],

	create: (name: string): Room => {
		const room: Room = {
			name,
			channel: `room:${toKey(name)}`,
			status: 'waiting',
			players: new Map(),
			textId: null,
			lastTextId: null,
			textLength: 0,
			gameStartedAt: null,
			timer: null,
		};
		rooms.set(toKey(name), room);
		return room;
	},

	delete: (name: string) => rooms.delete(toKey(name)),
};

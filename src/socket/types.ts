import type { Server, Socket } from 'socket.io';
import { CLIENT_EVENTS, SERVER_EVENTS } from './events';
import type { CommentDto } from '../commentator/types';

/* ---------- Domain (lives only on the server) ---------- */

export type RoomStatus = 'waiting' | 'countdown' | 'playing';

export interface Player {
	username: string;
	ready: boolean;
	typedChars: number;
	/** ms from the game start, null while still typing */
	finishTimeMs: number | null;
}

export interface Room {
	name: string;
	/** socket.io room name, e.g. "room:my room" */
	channel: string;
	status: RoomStatus;
	/** insertion order of the Map = join order */
	players: Map<string, Player>;
	textId: number | null;
	lastTextId: number | null;
	textLength: number;
	gameStartedAt: number | null;
	/** countdown OR game timer — only one can be active at a time */
	timer: ReturnType<typeof setTimeout> | null;
}

/* ---------- DTOs (what travels over the wire) ---------- */

export interface RoomSummaryDto {
	name: string;
	numberOfUsers: number;
}

export interface PlayerDto {
	username: string;
	ready: boolean;
	/** 0..100 */
	progress: number;
	finished: boolean;
}

export interface RoomDetailsDto {
	name: string;
	users: PlayerDto[];
}

export interface GameResultDto {
	place: number;
	username: string;
	finished: boolean;
	progress: number;
	finishTimeMs: number | null;
	wpm: number;
	charsPerMinute: number;
}

export type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };
export type AckCallback<T> = (response: AckResponse<T>) => void;

/* ---------- Typed socket.io ---------- */

export interface ClientToServerEvents {
	[CLIENT_EVENTS.CREATE_ROOM]: (roomName: string, ack: AckCallback<RoomDetailsDto>) => void;
	[CLIENT_EVENTS.JOIN_ROOM]: (roomName: string, ack: AckCallback<RoomDetailsDto>) => void;
	[CLIENT_EVENTS.LEAVE_ROOM]: (ack?: AckCallback<null>) => void;
	[CLIENT_EVENTS.SET_READY]: (ready: boolean) => void;
	[CLIENT_EVENTS.UPDATE_PROGRESS]: (typedChars: number) => void;
}

export interface ServerToClientEvents {
	[SERVER_EVENTS.ROOMS_UPDATED]: (rooms: RoomSummaryDto[]) => void;
	[SERVER_EVENTS.ROOM_USERS_UPDATED]: (users: PlayerDto[]) => void;
	[SERVER_EVENTS.COUNTDOWN_STARTED]: (payload: { textId: number; seconds: number }) => void;
	[SERVER_EVENTS.GAME_STARTED]: (payload: { seconds: number }) => void;
	[SERVER_EVENTS.PROGRESS_UPDATED]: (payload: { username: string; progress: number; finished: boolean }) => void;
	[SERVER_EVENTS.GAME_FINISHED]: (payload: { results: GameResultDto[] }) => void;
	[SERVER_EVENTS.COMMENT]: (comment: CommentDto) => void;
}

export interface SocketData {
	username: string;
	roomName: string | null;
}

// Used only when several socket.io servers talk to each other (adapters) — not our case
type InterServerEvents = Record<string, never>;

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

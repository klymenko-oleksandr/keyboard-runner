// Single place with all event names. The browser has a mirror copy in
// public/javascript/constants/events.mjs — keep them in sync.

// Client -> Server
export const CLIENT_EVENTS = {
	CREATE_ROOM: 'room:create',
	JOIN_ROOM: 'room:join',
	LEAVE_ROOM: 'room:leave',
	SET_READY: 'player:set-ready',
	UPDATE_PROGRESS: 'game:update-progress',
} as const;

// Server -> Client
export const SERVER_EVENTS = {
	ROOMS_UPDATED: 'rooms:updated',
	ROOM_USERS_UPDATED: 'room:users-updated',
	COUNTDOWN_STARTED: 'game:countdown-started',
	GAME_STARTED: 'game:started',
	PROGRESS_UPDATED: 'game:progress-updated',
	GAME_FINISHED: 'game:finished',
	COMMENT: 'commentator:comment',
} as const;

// Messages of errors thrown from the connection middleware (arrive as `connect_error` on the client)
export const CONNECTION_ERRORS = {
	USERNAME_TAKEN: 'USERNAME_TAKEN',
	INVALID_USERNAME: 'INVALID_USERNAME',
} as const;

// Socket.io room that holds every user who is currently on the rooms list page
export const LOBBY_CHANNEL = 'lobby';

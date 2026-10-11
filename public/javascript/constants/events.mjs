// Mirror of src/socket/events.ts — keep them in sync.

export const CLIENT_EVENTS = {
	CREATE_ROOM: 'room:create',
	JOIN_ROOM: 'room:join',
	LEAVE_ROOM: 'room:leave',
	SET_READY: 'player:set-ready',
	UPDATE_PROGRESS: 'game:update-progress',
};

export const SERVER_EVENTS = {
	ROOMS_UPDATED: 'rooms:updated',
	ROOM_USERS_UPDATED: 'room:users-updated',
	COUNTDOWN_STARTED: 'game:countdown-started',
	GAME_STARTED: 'game:started',
	PROGRESS_UPDATED: 'game:progress-updated',
	GAME_FINISHED: 'game:finished',
};

export const CONNECTION_ERRORS = {
	USERNAME_TAKEN: 'USERNAME_TAKEN',
	INVALID_USERNAME: 'INVALID_USERNAME',
};

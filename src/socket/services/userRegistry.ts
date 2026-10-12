// Who is online right now: username -> the browser tab (session) and socket that own it.
interface OnlineUser {
	/** random id the browser tab keeps in sessionStorage; survives page reloads */
	sessionId: string;
	socketId: string;
}

const onlineUsers = new Map<string, OnlineUser>();

export const userRegistry = {
	get: (username: string) => onlineUsers.get(username),

	set: (username: string, user: OnlineUser) => onlineUsers.set(username, user),

	/**
	 * Remove only if this socket still owns the username.
	 * After a reload the NEW socket already owns it — the old socket's late `disconnect` must not remove it.
	 */
	removeIfOwner: (username: string, socketId: string) => {
		if (onlineUsers.get(username)?.socketId === socketId) {
			onlineUsers.delete(username);
		}
	},
};

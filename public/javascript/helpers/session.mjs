// Everything the browser tab remembers about the logged-in user.
// sessionStorage is per tab and survives a page reload — exactly what we need.

const USERNAME_KEY = 'username';
const SESSION_ID_KEY = 'sessionId';

const createSessionId = () =>
	window.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const getUsername = () => sessionStorage.getItem(USERNAME_KEY);

/**
 * Random id of THIS tab. The server uses it to tell "the same person reloaded the page"
 * from "someone else wants the same username".
 */
export const getSessionId = () => {
	let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
	if (!sessionId) {
		sessionId = createSessionId();
		sessionStorage.setItem(SESSION_ID_KEY, sessionId);
	}
	return sessionId;
};

export const saveUsername = username => {
	sessionStorage.setItem(USERNAME_KEY, username);
	getSessionId();
};

export const clearSession = () => sessionStorage.clear();

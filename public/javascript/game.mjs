import { CONNECTION_ERRORS } from './constants/events.mjs';
import { clearSession, getSessionId, getUsername } from './helpers/session.mjs';
import { fetchConfig } from './helpers/api.mjs';
import { createRoomsPage } from './pages/roomsPage.mjs';
import { createRoomPage } from './pages/roomPage.mjs';
import { renderBriefing } from './views/briefing.mjs';
import { createCommentaryPanel } from './views/commentary.mjs';
import { initMobileNotice } from './views/mobileNotice.mjs';
import { showMessageModal } from './views/modal.mjs';

const username = getUsername();

const logout = () => {
	clearSession();
	window.location.replace('/login');
};

const init = async () => {
	initMobileNotice();

	const config = await fetchConfig().catch(() => null);
	if (config) {
		renderBriefing(document.querySelector('#briefing'), config);
	}

	const socket = io('', {
		query: { username },
		// sessionId = "this browser tab". Lets the server recognise a page reload as the same user.
		auth: { username, sessionId: getSessionId() },
		// close the connection right away on reload/close, so the server frees the username quickly
		closeOnBeforeunload: true,
	});

	// Rejected by the server middleware (see src/socket/middleware/authMiddleware.ts)
	socket.on('connect_error', error => {
		if (error.message === CONNECTION_ERRORS.USERNAME_TAKEN) {
			alert(`User "${username}" is already online. Please choose another username.`);
			logout();
		} else if (error.message === CONNECTION_ERRORS.INVALID_USERNAME) {
			alert('Invalid username. Please log in again.');
			logout();
		}
		// any other error = network problem, socket.io keeps reconnecting by itself
	});

	// The server closed THIS connection: the same session connected again from another tab
	// (e.g. "Duplicate tab"), and the newest tab wins.
	socket.on('disconnect', reason => {
		if (reason === 'io server disconnect') {
			showMessageModal({
				message: 'You opened Keyboard Runner in another tab, so this one was disconnected.',
				buttonText: 'Back to login',
				onClose: logout,
			});
		}
	});

	const roomsPage = createRoomsPage({
		socket,
		maxUsers: config?.maxUsers,
		onEnterRoom: roomDetails => {
			roomsPage.hide();
			roomPage.enter(roomDetails);
		},
	});

	const roomPage = createRoomPage({
		socket,
		username,
		commentary: createCommentaryPanel({ commentatorName: config?.commentatorName }),
		onLeave: () => roomsPage.show(),
	});

	// After a reconnect the server sees a brand-new socket that is not in any room,
	// so the UI must go back to the rooms list as well.
	socket.on('connect', () => {
		roomPage.reset();
		roomsPage.show();
	});

	document.querySelector('#current-username').textContent = username;
	document.querySelector('#logout-btn').addEventListener('click', () => {
		socket.disconnect();
		logout();
	});
};

if (!username) {
	window.location.replace('/login');
} else {
	init();
}

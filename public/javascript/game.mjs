import { CONNECTION_ERRORS } from './constants/events.mjs';
import { createRoomsPage } from './pages/roomsPage.mjs';
import { createRoomPage } from './pages/roomPage.mjs';

const username = sessionStorage.getItem('username');

const logout = () => {
	sessionStorage.clear();
	window.location.replace('/login');
};

const init = () => {
	const socket = io('', {
		query: { username },
		// close the connection right away on reload, so the server frees the username immediately
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

	const roomsPage = createRoomsPage({
		socket,
		onEnterRoom: roomDetails => {
			roomsPage.hide();
			roomPage.enter(roomDetails);
		},
	});

	const roomPage = createRoomPage({
		socket,
		username,
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

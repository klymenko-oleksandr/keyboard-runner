import { CLIENT_EVENTS, SERVER_EVENTS } from '../constants/events.mjs';
import { hide, show } from '../helpers/domHelper.mjs';
import { startCountdown } from '../helpers/countdown.mjs';
import { fetchText } from '../helpers/api.mjs';
import { renderUsers, setProgress } from '../views/user.mjs';
import { showMessageModal, showResultsModal } from '../views/modal.mjs';
import { createTypingRace } from '../game/typingRace.mjs';
import { getLightsForSecondsLeft, lightsOut, setLightsOn } from '../views/startLights.mjs';

const formatClock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Room + race page (#game-page).
 * The server decides WHEN things happen (countdown, start, finish) — this page only reacts to events.
 */
export const createRoomPage = ({ socket, username, onLeave }) => {
	const elements = {
		page: document.querySelector('#game-page'),
		roomName: document.querySelector('#room-name'),
		quitButton: document.querySelector('#quit-room-btn'),
		readyButton: document.querySelector('#ready-btn'),
		readyPanel: document.querySelector('#ready-panel'),
		timer: document.querySelector('#timer'),
		textContainer: document.querySelector('#text-container'),
		gameTimer: document.querySelector('#game-timer'),
		gameTimerSeconds: document.querySelector('#game-timer-seconds'),
		typingSpeed: document.querySelector('#typing-speed'),
		finishedMessage: document.querySelector('#finished-message'),
	};

	let isInRoom = false;
	let isReady = false;
	// While the results modal is open we keep the final progress bars on screen
	// and apply the latest users list only after the modal is closed.
	let isResultsOpen = false;
	let pendingUsers = null;
	let textPromise = null;
	let race = null;
	let stopVisualTimer = () => {};

	/* ---------- UI states ---------- */

	const showWaitingState = () => {
		hide(elements.timer);
		hide(elements.textContainer);
		hide(elements.gameTimer);
		hide(elements.typingSpeed);
		hide(elements.finishedMessage);
		show(elements.quitButton);
		show(elements.readyPanel);
		lightsOut();
	};

	const updateReadyButton = () => {
		elements.readyButton.textContent = isReady ? 'NOT READY' : 'READY';
		elements.readyButton.classList.toggle('is-ready', isReady);
	};

	const updateUsers = users => {
		if (isResultsOpen) {
			pendingUsers = users;
			return;
		}
		isReady = Boolean(users.find(user => user.username === username)?.ready);
		updateReadyButton();
		renderUsers({ users, currentUsername: username });
	};

	const stopRace = () => {
		stopVisualTimer();
		race?.stop(); // removes the keydown listener
		race = null;
		textPromise = null;
	};

	/* ---------- Public API ---------- */

	const enter = ({ name, users }) => {
		isInRoom = true;
		elements.roomName.textContent = name;
		updateUsers(users);
		showWaitingState();
		show(elements.page);
	};

	const leave = () => {
		socket.emit(CLIENT_EVENTS.LEAVE_ROOM, () => {
			reset();
			onLeave();
		});
	};

	/** Forget everything about the room (after leaving or after a reconnect) */
	const reset = () => {
		isInRoom = false;
		isResultsOpen = false;
		pendingUsers = null;
		stopRace();
		hide(elements.page);
	};

	/* ---------- User actions ---------- */

	elements.quitButton.addEventListener('click', leave);
	elements.readyButton.addEventListener('click', () => {
		// No optimistic update: the button changes when the server confirms via ROOM_USERS_UPDATED
		socket.emit(CLIENT_EVENTS.SET_READY, !isReady);
	});

	/* ---------- Server events ---------- */

	socket.on(SERVER_EVENTS.ROOM_USERS_UPDATED, users => {
		if (isInRoom) {
			updateUsers(users);
		}
	});

	socket.on(SERVER_EVENTS.COUNTDOWN_STARTED, ({ textId, seconds }) => {
		if (!isInRoom) {
			return;
		}
		hide(elements.quitButton);
		hide(elements.readyPanel);

		// Load the text while the countdown is running; show it only when the game starts
		textPromise = fetchText(textId);
		textPromise.catch(() => {}); // handled in GAME_STARTED

		// F1 start: the last 5 seconds light the 5 red lights one by one.
		// At 0 they stay on for a random moment (only the server knows it) — then "lights out" = GAME_STARTED.
		show(elements.timer);
		stopVisualTimer = startCountdown({
			seconds,
			onTick: secondsLeft => {
				elements.timer.textContent = secondsLeft > 0 ? secondsLeft : '';
				setLightsOn(getLightsForSecondsLeft(secondsLeft));
			},
		});
	});

	socket.on(SERVER_EVENTS.GAME_STARTED, async ({ seconds }) => {
		if (!isInRoom || !textPromise) {
			return;
		}
		stopVisualTimer();
		hide(elements.timer);
		lightsOut(); // and away we go!

		let text;
		try {
			text = await textPromise;
		} catch (error) {
			showMessageModal({ message: 'Could not load the text. Please try again.' });
			return;
		}

		show(elements.textContainer);
		show(elements.gameTimer);
		show(elements.typingSpeed);

		stopVisualTimer = startCountdown({
			seconds,
			onTick: secondsLeft => (elements.gameTimerSeconds.textContent = formatClock(secondsLeft)),
		});

		race = createTypingRace({
			text,
			container: elements.textContainer,
			speedElement: elements.typingSpeed,
			onProgress: typedChars => socket.emit(CLIENT_EVENTS.UPDATE_PROGRESS, typedChars),
			onFinish: () => show(elements.finishedMessage),
		});
		race.start();
	});

	socket.on(SERVER_EVENTS.PROGRESS_UPDATED, progress => {
		if (isInRoom) {
			setProgress(progress);
		}
	});

	socket.on(SERVER_EVENTS.GAME_FINISHED, ({ results }) => {
		if (!isInRoom) {
			return;
		}
		stopRace();
		hide(elements.gameTimer);
		hide(elements.finishedMessage);

		isResultsOpen = true;
		showResultsModal({
			results,
			currentUsername: username,
			onClose: () => {
				isResultsOpen = false;
				if (!isInRoom) {
					return;
				}
				if (pendingUsers) {
					updateUsers(pendingUsers);
					pendingUsers = null;
				}
				showWaitingState();
			},
		});
	});

	return { enter, reset };
};

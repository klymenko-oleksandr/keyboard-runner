import { addClass, createElement } from '../helpers/domHelper.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';

const getReadyStatusClass = ready => (ready ? 'ready-status-green' : 'ready-status-red');

const getStatusText = ({ progress, finished }) => (finished ? 'finished' : `${progress}%`);

/** Top-down race car. Its color comes from CSS (`currentColor`), so `.finished` / `.current-user` can repaint it. */
const createCar = () => {
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 58 28');
	svg.setAttribute('width', '58');
	svg.setAttribute('height', '28');
	svg.setAttribute('aria-hidden', 'true');
	svg.classList.add('car');

	const wheels = [
		[10, 2],
		[38, 2],
		[10, 21],
		[38, 21],
	].map(([x, y]) => {
		const wheel = document.createElementNS(SVG_NS, 'rect');
		Object.entries({ x, y, width: 10, height: 5, rx: 1.5, class: 'car-wheel' }).forEach(([k, v]) =>
			wheel.setAttribute(k, String(v)),
		);
		return wheel;
	});

	const body = document.createElementNS(SVG_NS, 'path');
	body.setAttribute('d', 'M4 9 Q4 6 8 6 L44 6 Q56 8 56 14 Q56 20 44 22 L8 22 Q4 22 4 19 Z');
	body.setAttribute('fill', 'currentColor');

	const cockpit = document.createElementNS(SVG_NS, 'rect');
	Object.entries({ x: 30, y: 10, width: 8, height: 8, rx: 2, class: 'car-cockpit' }).forEach(([k, v]) =>
		cockpit.setAttribute(k, String(v)),
	);

	svg.append(...wheels, body, cockpit);
	return svg;
};

const createUserElement = ({ username, ready, progress, finished, isCurrentUser }) => {
	const readyStatusElement = createElement({
		tagName: 'span',
		className: `ready-status ${getReadyStatusClass(ready)}`,
		attributes: { title: ready ? 'ready' : 'not ready' },
	});

	const usernameElement = createElement({
		tagName: 'span',
		className: 'username',
		innerElements: isCurrentUser
			? [username, createElement({ tagName: 'em', className: 'you-label', innerElements: [' (you)'] })]
			: [username],
	});

	const driverElement = createElement({
		tagName: 'div',
		className: 'lane-driver',
		innerElements: [readyStatusElement, usernameElement],
	});

	// Required format: `user-progress ${username}` (+ `finished`).
	// It is the "trail" behind the car: its width is the progress, the car rides on its right edge.
	const progressElement = createElement({
		tagName: 'div',
		className: `user-progress ${username}${finished ? ' finished' : ''}`,
		attributes: { style: `width: ${progress}%;` },
		innerElements: [createCar()],
	});

	const trackElement = createElement({
		tagName: 'div',
		className: 'lane-track user-progress-template',
		innerElements: [progressElement],
	});

	const statusElement = createElement({
		tagName: 'span',
		className: 'lane-status',
		attributes: { 'data-status-for': username },
		innerElements: [getStatusText({ progress, finished })],
	});

	return createElement({
		tagName: 'div',
		className: `user lane${isCurrentUser ? ' current-user' : ''}`,
		innerElements: [
			driverElement,
			trackElement,
			statusElement,
			createElement({ tagName: 'div', className: 'finish-line', attributes: { 'aria-hidden': 'true' } }),
		],
	});
};

export const renderUsers = ({ users, currentUsername }) => {
	const usersContainer = document.querySelector('#users-wrapper');
	const elements = users.map(user => createUserElement({ ...user, isCurrentUser: user.username === currentUsername }));
	usersContainer.replaceChildren(...elements);
};

export const setProgress = ({ username, progress, finished }) => {
	// usernames are validated ([A-Za-z0-9_-]), so they are safe as a class selector
	const progressElement = document.querySelector(`.user-progress.${CSS.escape(username)}`);
	if (!progressElement) {
		return;
	}

	progressElement.style.width = `${progress}%`;
	if (finished) {
		addClass(progressElement, 'finished');
	}

	const statusElement = document.querySelector(`.lane-status[data-status-for="${CSS.escape(username)}"]`);
	if (statusElement) {
		statusElement.textContent = getStatusText({ progress, finished });
	}
};

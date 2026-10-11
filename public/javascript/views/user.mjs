import { addClass, createElement } from '../helpers/domHelper.mjs';

const getReadyStatusClass = ready => (ready ? 'ready-status-green' : 'ready-status-red');

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

	const headerWrapper = createElement({
		tagName: 'div',
		className: 'user-header',
		innerElements: [readyStatusElement, usernameElement],
	});

	// Required format: `user-progress ${username}` (+ `finished`)
	const progressElement = createElement({
		tagName: 'div',
		className: `user-progress ${username}${finished ? ' finished' : ''}`,
		attributes: { style: `width: ${progress}%;` },
	});

	const progressElementBlock = createElement({
		tagName: 'div',
		className: 'user-progress-template',
		innerElements: [progressElement],
	});

	return createElement({
		tagName: 'div',
		className: `user${isCurrentUser ? ' current-user' : ''}`,
		innerElements: [headerWrapper, progressElementBlock],
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
};

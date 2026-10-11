import { createElement } from '../helpers/domHelper.mjs';

const getNumberOfUsersString = numberOfUsers =>
	`${numberOfUsers} ${numberOfUsers === 1 ? 'user' : 'users'} connected`;

const createRoomElement = ({ name, numberOfUsers, onJoin }) => {
	const connectedUsersElement = createElement({
		tagName: 'div',
		className: 'connected-users',
		innerElements: [getNumberOfUsersString(numberOfUsers)],
	});

	const nameElement = createElement({
		tagName: 'div',
		className: 'room-name',
		attributes: { title: name },
		innerElements: [name],
	});

	const joinButton = createElement({
		tagName: 'button',
		className: 'join-btn',
		innerElements: ['Join'],
	});
	joinButton.addEventListener('click', () => onJoin(name));

	return createElement({
		tagName: 'div',
		className: 'room',
		innerElements: [connectedUsersElement, nameElement, joinButton],
	});
};

/**
 * The server always sends the full (small) list, so we simply re-render it.
 * No need to look rooms up by name -> any room name is safe, even with quotes.
 */
export const renderRooms = ({ rooms, onJoin }) => {
	const roomsContainer = document.querySelector('#rooms-wrapper');

	if (rooms.length === 0) {
		roomsContainer.replaceChildren(
			createElement({
				tagName: 'p',
				className: 'rooms-empty',
				innerElements: ['No open rooms yet. Create the first one!'],
			}),
		);
		return;
	}

	roomsContainer.replaceChildren(...rooms.map(room => createRoomElement({ ...room, onJoin })));
};

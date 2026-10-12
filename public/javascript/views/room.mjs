import { createElement } from '../helpers/domHelper.mjs';

const getNumberOfUsersString = (numberOfUsers, maxUsers) => {
	const drivers = maxUsers ? `${numberOfUsers}/${maxUsers}` : String(numberOfUsers);
	return `${drivers} ${numberOfUsers === 1 && !maxUsers ? 'driver' : 'drivers'}`;
};

// Each room is a starting-grid slot: P1, P2, ...
const createRoomElement = ({ name, numberOfUsers, slot, maxUsers, onJoin }) => {
	const slotNumber = createElement({
		tagName: 'span',
		className: 'slot-number',
		attributes: { 'aria-hidden': 'true' },
		innerElements: [`P${slot}`],
	});

	const connectedUsersElement = createElement({
		tagName: 'span',
		className: 'slot-count',
		innerElements: [getNumberOfUsersString(numberOfUsers, maxUsers)],
	});

	const nameElement = createElement({
		tagName: 'div',
		className: 'slot-title',
		attributes: { title: name },
		innerElements: [name],
	});

	const joinButton = createElement({
		tagName: 'button',
		className: 'join-btn btn btn-primary btn-small',
		attributes: { 'aria-label': `Join ${name}` },
		innerElements: ['Join'],
	});
	joinButton.addEventListener('click', () => onJoin(name));

	return createElement({
		tagName: 'div',
		className: 'room slot',
		innerElements: [
			createElement({ tagName: 'div', className: 'slot-header', innerElements: [slotNumber, connectedUsersElement] }),
			nameElement,
			joinButton,
		],
	});
};

/**
 * The server always sends the full (small) list, so we simply re-render it.
 * No need to look rooms up by name -> any room name is safe, even with quotes.
 */
export const renderRooms = ({ rooms, maxUsers, onJoin }) => {
	const roomsContainer = document.querySelector('#rooms-wrapper');

	if (rooms.length === 0) {
		roomsContainer.replaceChildren(
			createElement({
				tagName: 'p',
				className: 'rooms-empty',
				innerElements: ['No rooms on the grid yet. Create the first one.'],
			}),
		);
		return;
	}

	roomsContainer.replaceChildren(
		...rooms.map((room, index) => createRoomElement({ ...room, slot: index + 1, maxUsers, onJoin })),
	);
};

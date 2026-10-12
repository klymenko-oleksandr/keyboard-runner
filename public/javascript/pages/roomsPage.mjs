import { CLIENT_EVENTS, SERVER_EVENTS } from '../constants/events.mjs';
import { ROOM_NAME_MAX_LENGTH } from '../constants/validation.mjs';
import { hide, show } from '../helpers/domHelper.mjs';
import { renderRooms } from '../views/room.mjs';
import { showMessageModal } from '../views/modal.mjs';

/**
 * Rooms list page (#rooms-page).
 * @param onEnterRoom called with room details after a successful create/join
 */
export const createRoomsPage = ({ socket, maxUsers, onEnterRoom }) => {
	const pageElement = document.querySelector('#rooms-page');
	const addRoomButton = document.querySelector('#add-room-btn');

	const joinRoom = name => {
		// Acknowledgement: the 3rd argument is a callback the SERVER calls with the result
		socket.emit(CLIENT_EVENTS.JOIN_ROOM, name, response => {
			if (!response.ok) {
				showMessageModal({ message: response.error });
				return;
			}
			onEnterRoom(response.data);
		});
	};

	const createRoom = () => {
		const name = window.prompt(`Room name (max ${ROOM_NAME_MAX_LENGTH} characters):`);
		if (name === null) {
			return; // "Cancel"
		}
		if (!name.trim()) {
			showMessageModal({ message: 'Room name cannot be empty' });
			return;
		}

		socket.emit(CLIENT_EVENTS.CREATE_ROOM, name, response => {
			if (!response.ok) {
				showMessageModal({ message: response.error });
				return;
			}
			onEnterRoom(response.data);
		});
	};

	addRoomButton.addEventListener('click', createRoom);

	// The server sends this only while we are in the lobby (on this page)
	socket.on(SERVER_EVENTS.ROOMS_UPDATED, rooms => renderRooms({ rooms, maxUsers, onJoin: joinRoom }));

	return {
		show: () => show(pageElement),
		hide: () => hide(pageElement),
	};
};

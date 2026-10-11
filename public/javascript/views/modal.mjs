import { createElement } from '../helpers/domHelper.mjs';

const createModalElement = title => {
	const titleElement = createElement({
		tagName: 'h1',
		className: 'title',
		innerElements: [title],
	});

	const modal = createElement({
		tagName: 'div',
		className: 'modal',
		attributes: { role: 'dialog', 'aria-modal': 'true' },
		innerElements: [titleElement],
	});

	return modal;
};

const getFooter = children =>
	createElement({
		tagName: 'div',
		className: 'inputs-wrapper',
		innerElements: children,
	});

/** Wraps the modal into a dimmed overlay and returns a function that closes it */
const mountModal = modalElement => {
	const overlay = createElement({ tagName: 'div', className: 'modal-overlay', innerElements: [modalElement] });
	document.querySelector('#root').append(overlay);
	return () => overlay.remove();
};

const formatResultMeta = ({ finished, finishTimeMs, progress }) =>
	finished ? `${(finishTimeMs / 1000).toFixed(1)} s` : `${progress}%`;

export const showResultsModal = ({ results, currentUsername, onClose = () => {} }) => {
	const modalElement = createModalElement('Results');

	const resultElements = results.map(result => {
		const { place, username } = result;

		return createElement({
			tagName: 'li',
			className: `user-result${username === currentUsername ? ' current-user' : ''}`,
			innerElements: [
				createElement({ tagName: 'span', className: 'result-place', innerElements: [`${place}.`] }),
				// Required: id `place-${place}` on every username
				createElement({
					tagName: 'span',
					className: 'result-username',
					attributes: { id: `place-${place}` },
					innerElements: [username],
				}),
				createElement({ tagName: 'span', className: 'result-meta', innerElements: [formatResultMeta(result)] }),
			],
		});
	});

	const bodyWrapper = createElement({
		tagName: 'ol',
		className: 'body-wrapper results-list',
		innerElements: resultElements,
	});

	const closeButton = createElement({
		tagName: 'button',
		className: 'submit-btn',
		attributes: { id: 'quit-results-btn' },
		innerElements: ['Close'],
	});

	modalElement.append(bodyWrapper, getFooter([closeButton]));
	const close = mountModal(modalElement);
	closeButton.focus();

	closeButton.addEventListener('click', () => {
		close();
		onClose();
	});
};

export const showMessageModal = ({ message, onClose = () => {} }) => {
	const modalElement = createModalElement(message);

	const closeButton = createElement({
		tagName: 'button',
		className: 'submit-btn',
		innerElements: ['Close'],
	});

	modalElement.append(getFooter([closeButton]));
	const close = mountModal(modalElement);
	closeButton.focus();

	closeButton.addEventListener('click', () => {
		close();
		onClose();
	});
};

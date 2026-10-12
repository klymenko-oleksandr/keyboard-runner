import { createElement } from '../helpers/domHelper.mjs';

/** Dimmed overlay + dark card with a checkered band on top. Returns a function that closes it. */
const mountModal = ({ title, children, labelId }) => {
	const titleElement = createElement({
		tagName: 'h1',
		className: 'modal-title',
		attributes: { id: labelId },
		innerElements: [title],
	});

	const modal = createElement({
		tagName: 'div',
		className: 'modal',
		attributes: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': labelId },
		innerElements: [
			createElement({ tagName: 'div', className: 'checker-band', attributes: { 'aria-hidden': 'true' } }),
			createElement({ tagName: 'div', className: 'modal-body', innerElements: [titleElement, ...children] }),
		],
	});

	const overlay = createElement({ tagName: 'div', className: 'modal-overlay', innerElements: [modal] });
	document.querySelector('#root').append(overlay);
	return () => overlay.remove();
};

const createFooter = button =>
	createElement({ tagName: 'div', className: 'modal-footer', innerElements: [button] });

const formatSeconds = ms => `${(ms / 1000).toFixed(1)} s`;

/** Winner: own time. Other finishers: gap to the winner. Still typing at the flag: how much was done. */
const formatTime = (result, winner) => {
	if (!result.finished) {
		return `${result.progress}% done`;
	}
	if (result === winner || !winner.finished) {
		return formatSeconds(result.finishTimeMs);
	}
	return `+${formatSeconds(result.finishTimeMs - winner.finishTimeMs)}`;
};

const createCell = (tagName, className, content, attributes = {}) =>
	createElement({ tagName, className, attributes, innerElements: [content] });

export const showResultsModal = ({ results, currentUsername, onClose = () => {} }) => {
	const [winner] = results;

	const header = createElement({
		tagName: 'tr',
		innerElements: [
			createCell('th', 'col-pos', 'Pos', { scope: 'col' }),
			createCell('th', 'col-driver', 'Driver', { scope: 'col' }),
			createCell('th', 'col-num', 'Time', { scope: 'col' }),
			createCell('th', 'col-num', 'WPM', { scope: 'col' }),
			createCell('th', 'col-num', 'Chars/min', { scope: 'col' }),
		],
	});

	const rows = results.map(result => {
		const isCurrentUser = result.username === currentUsername;
		const driver = createElement({
			tagName: 'td',
			className: 'col-driver',
			innerElements: [
				// Required: id `place-${place}` on every username
				createElement({
					tagName: 'span',
					className: 'result-username',
					attributes: { id: `place-${result.place}` },
					innerElements: [result.username],
				}),
				...(isCurrentUser ? [createElement({ tagName: 'em', className: 'you-label', innerElements: [' (you)'] })] : []),
			],
		});

		return createElement({
			tagName: 'tr',
			className: `user-result${isCurrentUser ? ' current-user' : ''}${result.place === 1 ? ' winner' : ''}`,
			innerElements: [
				createCell('td', 'col-pos', `P${result.place}`),
				driver,
				createCell('td', 'col-num', formatTime(result, winner)),
				createCell('td', 'col-num col-wpm', String(result.wpm)),
				createCell('td', 'col-num', String(result.charsPerMinute)),
			],
		});
	});

	const table = createElement({
		tagName: 'table',
		className: 'results-table',
		innerElements: [
			createElement({ tagName: 'thead', innerElements: [header] }),
			createElement({ tagName: 'tbody', innerElements: rows }),
		],
	});

	const note = createElement({
		tagName: 'p',
		className: 'modal-note',
		innerElements: [
			'Gaps are to the winner. Drivers still typing at the flag are ranked by characters typed. WPM counts every 5 characters as a word.',
		],
	});

	const closeButton = createElement({
		tagName: 'button',
		className: 'btn btn-primary',
		attributes: { id: 'quit-results-btn' },
		innerElements: ['Close'],
	});

	const close = mountModal({
		title: 'Final classification',
		labelId: 'results-title',
		children: [table, note, createFooter(closeButton)],
	});
	closeButton.focus();

	closeButton.addEventListener('click', () => {
		close();
		onClose();
	});
};

export const showMessageModal = ({ message, buttonText = 'Close', onClose = () => {} }) => {
	const closeButton = createElement({
		tagName: 'button',
		className: 'btn btn-primary',
		innerElements: [buttonText],
	});

	const close = mountModal({ title: message, labelId: 'message-title', children: [createFooter(closeButton)] });
	closeButton.focus();

	closeButton.addEventListener('click', () => {
		close();
		onClose();
	});
};

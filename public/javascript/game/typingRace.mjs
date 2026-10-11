import { addClass, createElement, removeClass } from '../helpers/domHelper.mjs';

const MISTAKE_HIGHLIGHT_MS = 200;

/**
 * Local typing logic: compares keys with the text, draws the highlighting,
 * and reports the number of correctly typed characters via `onProgress`.
 * Knows nothing about sockets.
 */
export const createTypingRace = ({ text, container, speedElement, onProgress, onFinish }) => {
	let typedChars = 0;
	let startedAt = null;
	let mistakeTimeoutId = null;

	const typedElement = createElement({ tagName: 'span', className: 'typed-text' });
	const nextCharElement = createElement({ tagName: 'span', className: 'next-char' });
	const restElement = createElement({ tagName: 'span', className: 'rest-text' });
	container.replaceChildren(typedElement, nextCharElement, restElement);

	const render = () => {
		typedElement.textContent = text.slice(0, typedChars);
		nextCharElement.textContent = text.charAt(typedChars);
		restElement.textContent = text.slice(typedChars + 1);
	};

	const renderSpeed = () => {
		if (!speedElement || !startedAt) {
			return;
		}
		const minutes = (Date.now() - startedAt) / 60000;
		const charsPerMinute = minutes > 0 ? Math.round(typedChars / minutes) : 0;
		speedElement.textContent = `${charsPerMinute} chars/min`;
	};

	const flashMistake = () => {
		addClass(nextCharElement, 'mistake');
		clearTimeout(mistakeTimeoutId);
		mistakeTimeoutId = setTimeout(() => removeClass(nextCharElement, 'mistake'), MISTAKE_HIGHLIGHT_MS);
	};

	const onKeyDown = event => {
		// ignore shortcuts (Ctrl+R, Cmd+C...) and non-character keys (Shift, Arrows, Backspace...)
		if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) {
			return;
		}
		event.preventDefault(); // e.g. Space would scroll the page

		if (event.key !== text[typedChars]) {
			flashMistake();
			return;
		}

		typedChars += 1;
		render();
		renderSpeed();
		onProgress(typedChars);

		if (typedChars === text.length) {
			stop();
			onFinish();
		}
	};

	const start = () => {
		startedAt = Date.now();
		typedChars = 0;
		render();
		if (speedElement) {
			speedElement.textContent = '0 chars/min';
		}
		document.addEventListener('keydown', onKeyDown);
	};

	const stop = () => {
		document.removeEventListener('keydown', onKeyDown);
		clearTimeout(mistakeTimeoutId);
	};

	render();
	return { start, stop };
};

import { createElement } from '../helpers/domHelper.mjs';

const MAX_COMMENTS = 40;
const SPEAKING_MS = 2400;

// Short label above each comment, by comment type (see src/commentator/types.ts)
const TYPE_LABELS = {
	greeting: 'Ефір',
	lineup: 'Стартова решітка',
	rivalry: 'Суперництво',
	track: 'Траса',
	start: 'Старт',
	status: 'Ситуація на трасі',
	overtake: 'Обгін',
	approaching: 'Фінішна пряма',
	finish: 'Фініш',
	retired: 'Бокси',
	results: 'Результат',
	filler: 'Між іншим',
};

const createCommentElement = ({ type, text }) =>
	createElement({
		tagName: 'li',
		className: `comment comment-${type} is-latest`,
		innerElements: [
			createElement({ tagName: 'span', className: 'comment-tag', innerElements: [TYPE_LABELS[type] ?? 'Коментар'] }),
			// text node, never HTML: comments contain usernames
			createElement({ tagName: 'p', className: 'comment-text', innerElements: [text] }),
		],
	});

/**
 * The commentator's booth next to the race (#commentary).
 * Reads like a chat: newest at the bottom, the feed scrolls itself.
 */
export const createCommentaryPanel = ({ commentatorName }) => {
	const panel = document.querySelector('#commentary');
	const feed = document.querySelector('#commentary-feed');
	let stopSpeakingTimer = null;

	if (commentatorName) {
		document.querySelector('#commentary-name').textContent = commentatorName;
	}

	const clear = () => {
		clearTimeout(stopSpeakingTimer);
		feed.replaceChildren();
		panel.classList.remove('has-comments', 'is-on-air', 'is-speaking');
	};

	const add = comment => {
		feed.querySelector('.is-latest')?.classList.remove('is-latest');
		feed.append(createCommentElement(comment));
		[...feed.children].slice(0, -MAX_COMMENTS).forEach(element => element.remove());
		feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });

		panel.classList.add('has-comments', 'is-speaking');
		// after the results the commentator says goodbye and goes off air
		panel.classList.toggle('is-on-air', comment.type !== 'results');
		clearTimeout(stopSpeakingTimer);
		stopSpeakingTimer = setTimeout(() => panel.classList.remove('is-speaking'), SPEAKING_MS);
	};

	return { clear, add };
};

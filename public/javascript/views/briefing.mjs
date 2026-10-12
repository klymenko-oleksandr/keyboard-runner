import { createElement } from '../helpers/domHelper.mjs';

const getSteps = ({ countdownSeconds, gameSeconds }) => [
	'Create a room or join one on the grid.',
	`Press Ready. When every driver is ready, a ${countdownSeconds}-second countdown starts and the start lights come on.`,
	'When the lights go out, type the text exactly. A wrong key keeps you in place.',
	`First across the line wins. After ${gameSeconds} seconds, the most characters typed wins.`,
];

/** "Race briefing": what the game is and how to play. Used on the login page and in the lobby. */
export const renderBriefing = (container, config) => {
	const title = createElement({ tagName: 'h2', className: 'briefing-title', innerElements: ['Race briefing'] });
	title.id = `${container.id}-title`;
	container.setAttribute('aria-labelledby', title.id);

	const lead = createElement({
		tagName: 'p',
		className: 'briefing-lead',
		innerElements: [`Up to ${config.maxUsers} drivers, one text, ${config.gameSeconds} seconds.`],
	});

	const steps = getSteps(config).map((text, index) =>
		createElement({
			tagName: 'li',
			className: 'briefing-step',
			innerElements: [
				createElement({ tagName: 'span', className: 'briefing-step-number', innerElements: [String(index + 1)] }),
				createElement({ tagName: 'span', innerElements: [text] }),
			],
		}),
	);

	const note = createElement({
		tagName: 'p',
		className: 'briefing-note',
		innerElements: ['Desktop only: you need a physical keyboard.'],
	});

	container.replaceChildren(
		title,
		lead,
		createElement({ tagName: 'ol', className: 'briefing-steps', innerElements: steps }),
		note,
	);
};

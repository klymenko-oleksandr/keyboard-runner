import { USERNAME_PATTERN, USERNAME_RULES_HINT } from './constants/validation.mjs';
import { getUsername, saveUsername } from './helpers/session.mjs';
import { fetchConfig } from './helpers/api.mjs';
import { renderBriefing } from './views/briefing.mjs';
import { initMobileNotice } from './views/mobileNotice.mjs';

if (getUsername()) {
	window.location.replace('/game');
}

initMobileNotice();

const submitButton = document.getElementById('submit-button');
const input = document.getElementById('username-input');
const errorElement = document.getElementById('login-error');

const showError = message => {
	errorElement.textContent = message;
};

const onClickSubmitButton = () => {
	const inputValue = input.value.trim();
	if (!inputValue) {
		showError('Enter a username to start.');
		return;
	}
	// The username becomes part of a CSS class (`user-progress ${username}`),
	// so spaces and special characters are not allowed.
	if (!USERNAME_PATTERN.test(inputValue)) {
		showError(USERNAME_RULES_HINT);
		return;
	}
	saveUsername(inputValue);
	window.location.replace('/game');
};

const onKeyDown = event => {
	if (event.key === 'Enter') {
		submitButton.click();
	}
};

submitButton.addEventListener('click', onClickSubmitButton);
input.addEventListener('input', () => showError(''));
window.addEventListener('keydown', onKeyDown);

fetchConfig()
	.then(config => renderBriefing(document.getElementById('briefing'), config))
	.catch(() => {}); // the briefing is a nice-to-have, login works without it

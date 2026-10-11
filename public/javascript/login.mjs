import { USERNAME_PATTERN, USERNAME_RULES_HINT } from './constants/validation.mjs';

const username = sessionStorage.getItem('username');

if (username) {
	window.location.replace('/game');
}

const submitButton = document.getElementById('submit-button');
const input = document.getElementById('username-input');
const errorElement = document.getElementById('login-error');

const showError = message => {
	errorElement.textContent = message;
};

const onClickSubmitButton = () => {
	const inputValue = input.value.trim();
	if (!inputValue) {
		return;
	}
	// The username becomes part of a CSS class (`user-progress ${username}`),
	// so spaces and special characters are not allowed.
	if (!USERNAME_PATTERN.test(inputValue)) {
		showError(USERNAME_RULES_HINT);
		return;
	}
	sessionStorage.setItem('username', inputValue);
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

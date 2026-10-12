// The notice itself is plain HTML shown by a CSS media query on touch-only devices
// (see .mobile-notice in common.css). Here we only let the user dismiss it for this tab.
const DISMISSED_KEY = 'mobileNoticeDismissed';

export const initMobileNotice = () => {
	const notice = document.querySelector('#mobile-notice');
	if (!notice) {
		return;
	}

	const dismiss = () => notice.classList.add('dismissed');

	if (sessionStorage.getItem(DISMISSED_KEY)) {
		dismiss();
	}

	notice.querySelector('#mobile-notice-continue')?.addEventListener('click', () => {
		sessionStorage.setItem(DISMISSED_KEY, '1');
		dismiss();
	});
};

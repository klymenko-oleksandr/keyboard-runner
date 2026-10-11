/**
 * Visual countdown. The server owns the real timers — this only draws the seconds.
 * Calculates the remaining time from Date.now(), so a slow/background tab never drifts.
 *
 * @returns {() => void} stop function
 */
export const startCountdown = ({ seconds, onTick, onEnd = () => {} }) => {
	const endsAt = Date.now() + seconds * 1000;
	let lastShown = null;

	const tick = () => {
		const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
		if (left !== lastShown) {
			lastShown = left;
			onTick(left);
		}
		if (left === 0) {
			stop();
			onEnd();
		}
	};

	const intervalId = setInterval(tick, 200);
	const stop = () => clearInterval(intervalId);

	tick();
	return stop;
};

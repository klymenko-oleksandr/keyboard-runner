// REST part of the app.

const getJson = async url => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`GET ${url} failed: ${response.status}`);
	}
	return response.json();
};

/** The socket says WHICH text (id), HTTP loads the text itself */
export const fetchText = async textId => {
	const { text } = await getJson(`/game/texts/${textId}`);
	return text;
};

/** Game rules: { maxUsers, countdownSeconds, gameSeconds }. Cached — they never change at runtime. */
let configPromise = null;
export const fetchConfig = () => {
	configPromise ??= getJson('/game/config').catch(error => {
		configPromise = null; // allow a retry next time
		throw error;
	});
	return configPromise;
};

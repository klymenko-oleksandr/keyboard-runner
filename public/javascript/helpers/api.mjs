/** REST part of the app: the socket says WHICH text, HTTP loads it */
export const fetchText = async textId => {
	const response = await fetch(`/game/texts/${textId}`);
	if (!response.ok) {
		throw new Error(`Failed to load text #${textId}: ${response.status}`);
	}
	const { text } = await response.json();
	return text;
};

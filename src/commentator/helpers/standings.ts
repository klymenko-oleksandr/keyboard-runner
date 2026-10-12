// Pure functions over the race state. No sockets, no timers, no randomness.
import { orderBy } from 'lodash';
import { APPROACH_CHARS } from '../config';
import type { Player, Room } from '../../socket/types';
import type { Standing } from '../types';

const toStanding = ({ username, typedChars, finishTimeMs }: Player): Standing => ({
	username,
	typedChars,
	finished: finishTimeMs !== null,
	finishTimeMs,
});

/** Finishers first (by time), then everyone else by typed characters */
export const getStandings = (room: Room): Standing[] =>
	orderBy(
		[...room.players.values()].map(toStanding),
		[standing => (standing.finished ? 0 : 1), standing => standing.finishTimeMs ?? 0, standing => -standing.typedChars],
	);

export const getProgressPercent = (standing: Standing, textLength: number) =>
	standing.finished || textLength === 0 ? 100 : Math.floor((standing.typedChars / textLength) * 100);

/** How many characters the driver is behind the leader */
export const getGap = (leader: Standing, standing: Standing) => Math.max(leader.typedChars - standing.typedChars, 0);

export const getSecondsLeft = (gameStartedAt: number, gameSeconds: number, now: number) =>
	Math.max(gameSeconds - Math.round((now - gameStartedAt) / 1000), 0);

/* ---------- Race moments: did this progress update cross a line? ---------- */

/** The "N characters to go" line. Very short texts: the first typed character already counts. */
export const getApproachLine = (textLength: number) => Math.max(textLength - APPROACH_CHARS, 1);

export const hasCrossed = (line: number, previous: number, current: number) => previous < line && current >= line;

export const isApproachMoment = (textLength: number, previous: number, current: number) =>
	current < textLength && hasCrossed(getApproachLine(textLength), previous, current);

export const isFinishMoment = (textLength: number, previous: number, current: number) =>
	textLength > 0 && hasCrossed(textLength, previous, current);

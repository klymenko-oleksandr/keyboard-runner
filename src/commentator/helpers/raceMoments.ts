// Pure functions that find "moments" worth a comment: rivalries, records, photo finishes, comebacks, overtakes.
import { maxBy } from 'lodash';
import { COMEBACK_MIN_PLACES, OVERTAKE_COOLDOWN_SECONDS, OVERTAKE_GRACE_SECONDS, OVERTAKE_PAIR_COOLDOWN_SECONDS } from '../config';
import { pairKey } from '../drivers/driverRepository';
import type { GameResultDto } from '../../socket/types';
import type { DriverProfile, HeadToHead, SpeedNews, Standing } from '../types';

/* ---------- Before the start ---------- */

/** The pair on the grid with the longest history together, if any */
export const findRivalry = (
	usernames: readonly string[],
	getHeadToHead: (first: string, second: string) => HeadToHead | undefined,
) => {
	const pairs = usernames.flatMap((first, index) =>
		usernames.slice(index + 1).flatMap(second => {
			const record = getHeadToHead(first, second);
			return record ? [{ drivers: [first, second] as [string, string], record }] : [];
		}),
	);
	return maxBy(pairs, pair => pair.record.meetings) ?? null;
};

/* ---------- During the race ---------- */

interface OvertakeTiming {
	now: number;
	gameStartedAt: number;
	lastOvertakeAt: number;
	/** pairKey -> when this pair was last announced */
	pairAnnouncedAt: ReadonlyMap<string, number>;
}

/**
 * Overtakes worth announcing: not in the first seconds (everyone moves at once), not too often,
 * and not the same two drivers swapping places again and again. A new leader is always news.
 */
export const filterAnnounceableOvertakes = (
	username: string,
	overtaken: readonly string[],
	isNewLeader: boolean,
	{ now, gameStartedAt, lastOvertakeAt, pairAnnouncedAt }: OvertakeTiming,
) => {
	if (now - gameStartedAt < OVERTAKE_GRACE_SECONDS * 1000) {
		return [];
	}
	if (!isNewLeader && now - lastOvertakeAt < OVERTAKE_COOLDOWN_SECONDS * 1000) {
		return [];
	}
	return overtaken.filter(
		other => now - (pairAnnouncedAt.get(pairKey(username, other)) ?? -Infinity) >= OVERTAKE_PAIR_COOLDOWN_SECONDS * 1000,
	);
};

/** Worst (largest) position each driver has had so far */
export const updateWorstPositions = (worst: ReadonlyMap<string, number>, order: readonly string[]) =>
	new Map(order.map((username, index) => [username, Math.max(worst.get(username) ?? 0, index + 1)]));

/* ---------- Finish line ---------- */

/** The finisher right before `username`, and the gap between them */
export const getPreviousFinisher = (standings: readonly Standing[], username: string) => {
	const finishers = standings.filter(standing => standing.finished);
	const index = finishers.findIndex(standing => standing.username === username);
	const current = finishers[index];
	const previous = finishers[index - 1];
	if (!current || !previous || current.finishTimeMs === null || previous.finishTimeMs === null) {
		return null;
	}
	return { username: previous.username, gapMs: current.finishTimeMs - previous.finishTimeMs };
};

/** Compares the speed on the finish line with the profile BEFORE this race */
export const getSpeedNews = (profile: DriverProfile, wpm: number): SpeedNews | null => {
	if (profile.races === 0) {
		return { kind: 'debut', wpm };
	}
	return wpm > profile.bestWpm ? { kind: 'personalBest', wpm, previousBest: profile.bestWpm } : null;
};

/* ---------- Results ---------- */

/** The biggest climb from the worst position during the race to a podium place */
export const findComeback = (results: readonly GameResultDto[], worstPositions: ReadonlyMap<string, number>) => {
	const climbs = results
		.filter(result => result.place <= 3)
		.map(result => ({
			username: result.username,
			place: result.place,
			worstPosition: worstPositions.get(result.username) ?? result.place,
		}))
		.filter(climb => climb.worstPosition - climb.place >= COMEBACK_MIN_PLACES);
	return maxBy(climbs, climb => climb.worstPosition - climb.place) ?? null;
};

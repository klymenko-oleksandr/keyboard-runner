// Driver profiles (car, races, wins, best speed, win streak) and head-to-head records.
// Reads stay in memory and synchronous: the commentator needs them instantly.
// With a database (storage/), the maps are filled once at startup and every change is written through.
import { sortBy } from 'lodash';
import type { GameResultDto } from '../../socket/types';
import type { Car, DriverProfile, HeadToHead } from '../types';

export interface DriverRepository {
	getOrCreate: (username: string) => DriverProfile;
	getHeadToHead: (first: string, second: string) => HeadToHead | undefined;
	recordResults: (results: GameResultDto[]) => void;
}

const createProfile = (username: string, car: Car): DriverProfile => ({
	username,
	car,
	races: 0,
	wins: 0,
	bestWpm: 0,
	winStreak: 0,
});

/**
 * Pure: old profile + one race result -> new profile.
 * A win needs someone to beat: in a solo race (or against a ghost) races and best speed count,
 * wins and the win streak neither grow nor reset.
 */
export const applyResult = (profile: DriverProfile, result: GameResultDto, playersInRace = 2): DriverProfile => {
	const contested = playersInRace >= 2;
	const isWin = contested && result.place === 1;
	return {
		...profile,
		races: profile.races + 1,
		wins: profile.wins + (isWin ? 1 : 0),
		bestWpm: Math.max(profile.bestWpm, result.wpm),
		winStreak: !contested ? profile.winStreak : isWin ? profile.winStreak + 1 : 0,
	};
};

/** "bob|alice" and "alice|bob" are the same pair */
export const pairKey = (first: string, second: string) => sortBy([first, second]).join('|');

/** Pure: old record (or none) + who won this time -> new record */
export const applyMeeting = (record: HeadToHead | undefined, winner: string): HeadToHead => ({
	meetings: (record?.meetings ?? 0) + 1,
	wins: { ...record?.wins, [winner]: (record?.wins[winner] ?? 0) + 1 },
	lastWinner: winner,
});

/** Every pair of drivers in one race. Results are sorted by place, so the first of a pair is the winner. */
export const toMeetings = (results: readonly GameResultDto[]) =>
	results.flatMap((winner, index) => results.slice(index + 1).map(loser => [winner.username, loser.username] as const));

/** What a database gives at startup and takes after every race */
export interface DriverSnapshot {
	profiles: DriverProfile[];
	headToHead: [key: string, record: HeadToHead][];
}

export interface DriverPersistence {
	initial?: DriverSnapshot;
	/** Called after every race with what changed. Must not throw; it is fire-and-forget. */
	save?: (changes: DriverSnapshot) => void;
}

export const createDriverRepository = (createCar: () => Car, persistence: DriverPersistence = {}): DriverRepository => {
	const profiles = new Map<string, DriverProfile>(persistence.initial?.profiles.map(p => [p.username, p]) ?? []);
	const headToHead = new Map<string, HeadToHead>(persistence.initial?.headToHead ?? []);

	const getOrCreate = (username: string) => {
		const existing = profiles.get(username);
		if (existing) {
			return existing;
		}
		const profile = createProfile(username, createCar());
		profiles.set(username, profile);
		return profile;
	};

	const getHeadToHead = (first: string, second: string) => headToHead.get(pairKey(first, second));

	const recordResults = (results: GameResultDto[]) => {
		const changedProfiles = results.map(result => {
			const updated = applyResult(getOrCreate(result.username), result, results.length);
			profiles.set(result.username, updated);
			return updated;
		});
		const changedMeetings = toMeetings(results).map(([winner, loser]) => {
			const key = pairKey(winner, loser);
			const record = applyMeeting(headToHead.get(key), winner);
			headToHead.set(key, record);
			return [key, record] as [string, HeadToHead];
		});
		persistence.save?.({ profiles: changedProfiles, headToHead: changedMeetings });
	};

	return { getOrCreate, getHeadToHead, recordResults };
};

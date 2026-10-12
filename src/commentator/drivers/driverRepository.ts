// In-memory driver profiles (car, races, wins, best speed, win streak) and head-to-head records.
// Same trade-off as rooms: a server restart (or Render putting the free instance to sleep) forgets them.
// To keep them for real, write another repository with the same interface on top of a database.
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

/** Pure: old profile + one race result -> new profile */
export const applyResult = (profile: DriverProfile, result: GameResultDto): DriverProfile => {
	const isWin = result.place === 1;
	return {
		...profile,
		races: profile.races + 1,
		wins: profile.wins + (isWin ? 1 : 0),
		bestWpm: Math.max(profile.bestWpm, result.wpm),
		winStreak: isWin ? profile.winStreak + 1 : 0,
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

export const createDriverRepository = (createCar: () => Car): DriverRepository => {
	const profiles = new Map<string, DriverProfile>();
	const headToHead = new Map<string, HeadToHead>();

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
		results.forEach(result => profiles.set(result.username, applyResult(getOrCreate(result.username), result)));
		toMeetings(results).forEach(([winner, loser]) => {
			const key = pairKey(winner, loser);
			headToHead.set(key, applyMeeting(headToHead.get(key), winner));
		});
	};

	return { getOrCreate, getHeadToHead, recordResults };
};

// In-memory driver profiles: car, number of races, wins, best speed.
// Same trade-off as rooms: a server restart (or Render putting the free instance to sleep) forgets them.
// To keep them for real, write another repository with the same interface on top of a database.
import type { GameResultDto } from '../../socket/types';
import type { Car, DriverProfile } from '../types';

export interface DriverRepository {
	getOrCreate: (username: string) => DriverProfile;
	recordResults: (results: GameResultDto[]) => void;
}

const createProfile = (username: string, car: Car): DriverProfile => ({
	username,
	car,
	races: 0,
	wins: 0,
	bestWpm: 0,
});

/** Pure: old profile + one race result -> new profile */
export const applyResult = (profile: DriverProfile, result: GameResultDto): DriverProfile => ({
	...profile,
	races: profile.races + 1,
	wins: profile.wins + (result.place === 1 ? 1 : 0),
	bestWpm: Math.max(profile.bestWpm, result.wpm),
});

export const createDriverRepository = (createCar: () => Car): DriverRepository => {
	const profiles = new Map<string, DriverProfile>();

	const getOrCreate = (username: string) => {
		const existing = profiles.get(username);
		if (existing) {
			return existing;
		}
		const profile = createProfile(username, createCar());
		profiles.set(username, profile);
		return profile;
	};

	const recordResults = (results: GameResultDto[]) => {
		results.forEach(result => profiles.set(result.username, applyResult(getOrCreate(result.username), result)));
	};

	return { getOrCreate, recordResults };
};

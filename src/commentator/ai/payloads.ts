// Template payload -> what the model gets (spec Revision 3, "Data for the model").
// Same facts as the template, renamed so they cannot be misread. Each rename fixes an error seen in the bench.
import type { CommentPayloads, DriverProfile } from '../types';

const seconds = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');

export interface PreraceInput {
	greeting: CommentPayloads['greeting'];
	lineup: CommentPayloads['lineup'][];
	rivalry: CommentPayloads['rivalry'] | null;
	track: CommentPayloads['track'] | null;
}

export const toPreracePayload = ({ greeting, lineup, rivalry, track }: PreraceInput) => ({
	roomName: greeting.roomName,
	weather: greeting.weather,
	drivers: lineup.map(({ driver, gridNumber }) => ({
		gridNumber,
		username: driver.username,
		// the colour is already in the locative case: "на зеленому Aston Martin"
		car: { brand: driver.car.brand, colorLocative: driver.car.color, number: driver.car.number },
		// "races: 1" was read as "the first race": both the count and which race this is
		racesBefore: driver.races,
		raceNumber: driver.races + 1,
		winsBefore: driver.wins,
		bestWpm: driver.races === 0 ? null : driver.bestWpm,
		winsInARow: driver.winStreak,
		debut: driver.races === 0,
	})),
	rivalry: rivalry && {
		drivers: rivalry.drivers,
		meetings: rivalry.record.meetings,
		wins: rivalry.record.wins,
		lastWinner: rivalry.record.lastWinner,
	},
	track: track && { title: track.book.titleUk, author: track.book.authorUk, fact: track.book.fact },
});

export const toStatusPayload = ({ standings, textLength, secondsLeft }: CommentPayloads['status']) => {
	const leaderChars = standings[0]?.typedChars ?? 0;
	return {
		// the race timer, not the time until the finish
		secondsLeft,
		textLength,
		standings: standings.map((standing, index) => ({
			position: index + 1,
			username: standing.username,
			percent: textLength ? Math.floor((100 * standing.typedChars) / textLength) : 0,
			charsBehindLeader: leaderChars - standing.typedChars,
			finished: standing.finished,
		})),
	};
};

/**
 * Results + what the finish lines already said, so the model does not have to infer it.
 * `profiles` are read BEFORE this race is recorded.
 */
export const toResultsPayload = (
	{ results, winnerStreak, comeback }: CommentPayloads['results'],
	profileOf: (username: string) => DriverProfile,
) => ({
	everyoneFinished: results.every(result => result.finished),
	results: results.map(result => {
		const before = profileOf(result.username);
		const debut = before.races === 0;
		return {
			place: result.place,
			username: result.username,
			finished: result.finished,
			timeSeconds: result.finishTimeMs === null ? null : seconds(result.finishTimeMs),
			wpm: result.wpm,
			percent: result.progress,
			debut,
			personalBest: !debut && result.wpm > before.bestWpm ? { previous: before.bestWpm } : null,
		};
	}),
	winnerWinsInARow: winnerStreak,
	comeback,
});

export type PreracePayload = ReturnType<typeof toPreracePayload>;
export type StatusPayload = ReturnType<typeof toStatusPayload>;
export type ResultsPayload = ReturnType<typeof toResultsPayload>;

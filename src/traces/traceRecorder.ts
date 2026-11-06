// Records every player's progress timeline during a race, one session per room (like the commentator).
// The game calls three hooks: start at lights out, a sample per accepted progress update, finish with the results.
import { createHash } from 'crypto';
import type { GameResultDto, Room } from '../socket/types';
import type { NewRaceTrace, ProgressSample } from './types';

interface LiveRace {
	text: string;
	startedAt: number;
	playersInRace: number;
	vsGhost: boolean;
	samples: Map<string, ProgressSample[]>;
}

export const textKeyOf = (text: string) => createHash('sha1').update(text).digest('hex');

export const createTraceRecorder = () => {
	const races = new Map<string, LiveRace>();

	/** Lights out: everyone in the room races from zero */
	const startRace = (room: Room, text: string, { startedAt, vsGhost = false }: { startedAt: number; vsGhost?: boolean }) => {
		races.set(room.name, {
			text,
			startedAt,
			playersInRace: room.players.size,
			vsGhost,
			samples: new Map([...room.players.keys()].map(username => [username, []])),
		});
	};

	/** One accepted progress update. Out-of-order or repeated counts are ignored (the handler already checks). */
	const addSample = (room: Room, username: string, ms: number, chars: number) => {
		const samples = races.get(room.name)?.samples.get(username);
		const last = samples?.at(-1);
		if (!samples || (last && chars <= last[1])) {
			return;
		}
		samples.push([Math.max(0, Math.round(ms)), chars]);
	};

	/** The race is over: one trace per player still in the room, in results order */
	const finishRace = (room: Room, results: readonly GameResultDto[]): NewRaceTrace[] => {
		const race = races.get(room.name);
		races.delete(room.name);
		if (!race) {
			return [];
		}
		const textKey = textKeyOf(race.text);
		return results.map(result => {
			const samples = race.samples.get(result.username) ?? [];
			return {
				username: result.username,
				text: race.text,
				textKey,
				textLength: race.text.length,
				startedAt: new Date(race.startedAt).toISOString(),
				samples,
				finishTimeMs: result.finishTimeMs,
				chars: samples.at(-1)?.[1] ?? 0,
				wpm: result.wpm,
				playersInRace: race.playersInRace,
				vsGhost: race.vsGhost,
			};
		});
	};

	/** The room is gone mid-race: nothing to keep */
	const dropRace = (room: Room) => {
		races.delete(room.name);
	};

	return { startRace, addSample, finishRace, dropRace };
};

export type TraceRecorder = ReturnType<typeof createTraceRecorder>;

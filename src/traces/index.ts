// The one trace recorder of the server, and what happens to a finished trace.
import { getStorage } from '../storage';
import { createTraceRecorder } from './traceRecorder';
import type { NewRaceTrace } from './types';

export type { RaceTrace, NewRaceTrace, ProgressSample, TraceRepository } from './types';

export const traceRecorder = createTraceRecorder();

/**
 * After the race: save every trace and write one JSON line per trace to the log.
 * Runs after `game:finished` is sent and never throws: a failed save is logged, the game goes on.
 */
export const keepTraces = async (traces: NewRaceTrace[]) => {
	const { traces: repository } = getStorage();
	await Promise.all(
		traces.map(trace =>
			repository
				.save(trace)
				.then(saved => console.log(JSON.stringify({ type: 'race-trace', ...saved })))
				.catch(error => {
					console.error('[traces] saving failed:', error instanceof Error ? error.message : error);
					console.log(JSON.stringify({ type: 'race-trace', unsaved: true, ...trace }));
				}),
		),
	);
};

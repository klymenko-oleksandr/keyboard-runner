import type { Collection } from 'mongodb';
import type { NewRaceTrace, RaceTrace, TraceRepository } from './types';

/** In memory: tests and running without MONGODB_URI. Forgets everything on restart. */
export const createMemoryTraceRepository = (): TraceRepository & { all: () => RaceTrace[] } => {
	const traces: RaceTrace[] = [];
	const save = async (trace: NewRaceTrace) => {
		const attempt = traces.filter(t => t.username === trace.username && t.textKey === trace.textKey).length + 1;
		const saved = { ...trace, attempt };
		traces.push(saved);
		return saved;
	};
	return { save, all: () => [...traces] };
};

/** MongoDB: collection `raceTraces`, index on { username, textKey } (see storage/mongo.ts) */
export const createMongoTraceRepository = (
	collection: Collection<RaceTrace & { createdAt: Date }>,
): TraceRepository => ({
	save: async trace => {
		// Two saves of the same player and text at the same moment are not possible: one race at a time per player
		const attempt = (await collection.countDocuments({ username: trace.username, textKey: trace.textKey })) + 1;
		const saved = { ...trace, attempt };
		await collection.insertOne({ ...saved, createdAt: new Date() });
		return saved;
	},
});

// Storage for what must survive a restart: race traces and driver profiles.
// With MONGODB_URI the data lives in MongoDB Atlas; without it (dev, tests) or if Atlas cannot be reached,
// everything stays in memory exactly as before. The game never waits on a write.
import { MongoClient } from 'mongodb';
import type { Collection, Db } from 'mongodb';
import { createMemoryTraceRepository, createMongoTraceRepository } from '../traces/traceRepository';
import type { RaceTrace, TraceRepository } from '../traces/types';
import type { DriverPersistence, DriverSnapshot } from '../commentator/drivers/driverRepository';
import type { DriverProfile, HeadToHead } from '../commentator/types';

const CONNECT_TIMEOUT_MS = 5000;

export interface Storage {
	kind: 'memory' | 'mongodb';
	traces: TraceRepository;
	drivers: DriverPersistence;
}

type DriverDoc = DriverProfile & { _id: string };
type HeadToHeadDoc = HeadToHead & { _id: string };
type TraceDoc = RaceTrace & { createdAt: Date };

const memoryStorage = (): Storage => ({ kind: 'memory', traces: createMemoryTraceRepository(), drivers: {} });

const logError = (what: string) => (error: unknown) =>
	console.error(`[storage] ${what} failed:`, error instanceof Error ? error.message : error);

const toProfile = ({ _id, ...profile }: DriverDoc): DriverProfile => ({ ...profile, username: _id });
const toHeadToHead = ({ _id, ...record }: HeadToHeadDoc): [string, HeadToHead] => [_id, record];

const saveDrivers = (drivers: Collection<DriverDoc>, headToHead: Collection<HeadToHeadDoc>) => (changes: DriverSnapshot) => {
	if (changes.profiles.length) {
		drivers
			.bulkWrite(
				changes.profiles.map(({ username, ...profile }) => ({
					replaceOne: { filter: { _id: username }, replacement: { ...profile, username }, upsert: true },
				})),
			)
			.catch(logError('saving driver profiles'));
	}
	if (changes.headToHead.length) {
		headToHead
			.bulkWrite(
				changes.headToHead.map(([key, record]) => ({ replaceOne: { filter: { _id: key }, replacement: record, upsert: true } })),
			)
			.catch(logError('saving head-to-head'));
	}
};

const mongoStorage = async (db: Db): Promise<Storage> => {
	const traces = db.collection<TraceDoc>('raceTraces');
	const drivers = db.collection<DriverDoc>('drivers');
	const headToHead = db.collection<HeadToHeadDoc>('headToHead');
	await traces.createIndex({ username: 1, textKey: 1 });

	// Driver data is small (one document per player and per pair): load it all once
	const [profileDocs, headToHeadDocs] = await Promise.all([drivers.find().toArray(), headToHead.find().toArray()]);
	console.log(`[storage] MongoDB: ${profileDocs.length} driver profiles, ${headToHeadDocs.length} rivalries loaded`);

	return {
		kind: 'mongodb',
		traces: createMongoTraceRepository(traces),
		drivers: {
			initial: { profiles: profileDocs.map(toProfile), headToHead: headToHeadDocs.map(toHeadToHead) },
			save: saveDrivers(drivers, headToHead),
		},
	};
};

let storage: Storage = memoryStorage();
let ready: Promise<Storage> = Promise.resolve(storage);

/** Connects once at startup. Resolves to the storage in use; never rejects. */
export const initStorage = (uri = process.env.MONGODB_URI): Promise<Storage> => {
	if (!uri) {
		console.log('[storage] MONGODB_URI is not set: traces and driver profiles stay in memory');
		return ready;
	}
	const client = new MongoClient(uri, { serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS, appName: 'keyboard-runner' });
	ready = client
		.connect()
		.then(connected => mongoStorage(connected.db()))
		.then(connectedStorage => (storage = connectedStorage))
		.catch(error => {
			logError('connecting to MongoDB')(error);
			console.log('[storage] falling back to memory');
			return storage;
		});
	return ready;
};

/** Socket connections wait for this, so driver profiles are loaded before the first race */
export const whenStorageReady = () => ready;

export const getStorage = () => storage;

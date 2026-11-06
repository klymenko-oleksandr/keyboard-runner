// AI layer of the commentator (spec Revision 3). Step 1: the pure parts and the model port, not wired in yet.
export * from './config';
export * from './payloads';
export * from './prompts';
export * from './validator';
export * from './preraceParts';
export type { LineWriter, WriteRequest, WriteResult } from './lineWriter';
export { createFakeWriter, realSleep } from './fakeWriter';
export type { ScriptedAnswer, Sleep } from './fakeWriter';

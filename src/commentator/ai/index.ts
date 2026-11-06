// AI layer of the commentator (spec Revision 3): pure parts, the model port and its Anthropic implementation, sayWithin.
export * from './config';
export * from './payloads';
export * from './prompts';
export * from './validator';
export * from './preraceParts';
export type { LineWriter, WriteRequest, WriteResult } from './lineWriter';
export { createFakeWriter, realSleep } from './fakeWriter';
export type { ScriptedAnswer, Sleep } from './fakeWriter';
export { createSayWithin } from './sayWithin';
export type { AiLine, AiOutcome, SayWithin, SayWithinRequest } from './sayWithin';
export { createAiCommentator } from './aiCommentator';
export type { AiCommentator, AiLog } from './aiCommentator';
export { costOf, createAnthropicWriter, toParams } from './anthropicWriter';
export type { MessagesClient } from './anthropicWriter';
export { createPreraceRunner } from './preraceStream';
export type { PreraceLog, PreracePartLog, PreraceRequest, PreraceRunner } from './preraceStream';

// PROXY: stands between the commentator and the microphone.
// It has the same interface as the real broadcaster, so nobody knows it is there,
// but every comment passes the censor before it reaches the players.
import { maskProfanity } from './profanity';
import type { Broadcaster, CommentDto } from '../types';

const censor = (comment: CommentDto): CommentDto => {
	const text = maskProfanity(comment.text);
	if (text !== comment.text) {
		console.warn(`[commentator] censored comment #${comment.id}`);
	}
	return text === comment.text ? comment : { ...comment, text };
};

export const withCensorship = <T extends Broadcaster>(broadcaster: T): T =>
	new Proxy(broadcaster, {
		get(target, property, receiver) {
			const value = Reflect.get(target, property, receiver);
			if (property !== 'say' || typeof value !== 'function') {
				return value;
			}
			const say: Broadcaster['say'] = (channel, comment) => value.call(target, channel, censor(comment));
			return say;
		},
	});

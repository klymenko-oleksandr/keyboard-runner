// FACTORY: the only place that knows how to build a comment of any type.
// Callers say WHAT happened (type + data); the factory decides HOW it sounds and what shape it has.
import { pickWith } from '../helpers/random';
import { polish } from '../helpers/text';
import { templates } from './templates';
import type { CommentDto, CommentPayloads, CommentType, Random, Templates } from '../types';

interface CommentFactoryDeps {
	random?: Random;
	now?: () => number;
	templates?: Templates;
}

export type CreateComment = <T extends CommentType>(type: T, payload: CommentPayloads[T]) => CommentDto;

/**
 * Higher-order function: takes dependencies, returns `createComment`.
 * Random and clock are injected, so tests get the same text every time.
 */
export const createCommentFactory = ({
	random = Math.random,
	now = Date.now,
	templates: commentTemplates = templates,
}: CommentFactoryDeps = {}): CreateComment => {
	const tools = { pick: pickWith(random) };
	let lastId = 0;

	return (type, payload) => {
		lastId += 1;
		return {
			id: lastId,
			type,
			text: polish(commentTemplates[type](payload, tools)),
			createdAt: now(),
		};
	};
};

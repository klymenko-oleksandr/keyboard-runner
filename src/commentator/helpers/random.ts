import type { Random } from '../types';

/**
 * Curried: give it a random source once, get a picker you can use everywhere.
 *   const pick = pickWith(Math.random);  pick(['a', 'b'])
 * In tests `pickWith(() => 0)` always returns the first item.
 */
export const pickWith =
	(random: Random) =>
	<T>(items: readonly T[]): T =>
		items[Math.min(Math.floor(random() * items.length), items.length - 1)];

/** Items not used yet; when everything has been used, start over with the full list */
export const getUnused = <T>(items: readonly T[], used: ReadonlySet<T>): readonly T[] => {
	const unused = items.filter(item => !used.has(item));
	return unused.length > 0 ? unused : items;
};

/** Random integer in [min, max] */
export const randomIntWith = (random: Random) => (min: number, max: number) =>
	min + Math.floor(random() * (max - min + 1));

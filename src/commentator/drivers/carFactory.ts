// FACTORY: every new driver gets a car. Same random source in, same garage out.
import { CAR_BRANDS, CAR_COLORS } from '../comments/phrases';
import { pickWith, randomIntWith } from '../helpers/random';
import type { Car, Random } from '../types';

export const createCarFactory = (random: Random = Math.random) => {
	const pick = pickWith(random);
	const randomInt = randomIntWith(random);

	return (): Car => ({
		brand: pick(CAR_BRANDS),
		color: pick(CAR_COLORS),
		number: randomInt(2, 99),
	});
};

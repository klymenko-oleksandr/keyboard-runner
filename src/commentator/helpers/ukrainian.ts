// Small pure helpers for natural Ukrainian text: plural forms, ordinals, lists, time.
import { curry } from 'lodash';

/** [one, few, many]: 1 секунда, 2 секунди, 5 секунд */
export type PluralForms = readonly [string, string, string];

const getPluralForm = (forms: PluralForms, count: number) => {
	const lastTwo = Math.abs(count) % 100;
	const last = lastTwo % 10;
	if (lastTwo >= 11 && lastTwo <= 14) {
		return forms[2];
	}
	if (last === 1) {
		return forms[0];
	}
	if (last >= 2 && last <= 4) {
		return forms[1];
	}
	return forms[2];
};

/**
 * Curried with lodash: fix the word once, use it with any number.
 *   const seconds = pluralize(['секунда', 'секунди', 'секунд']);
 *   seconds(21) -> "21 секунда"
 */
export const pluralize = curry((forms: PluralForms, count: number) => `${count} ${getPluralForm(forms, count)}`);

export const seconds = pluralize(['секунда', 'секунди', 'секунд']);
export const characters = pluralize(['символ', 'символи', 'символів']);
export const races = pluralize(['гонка', 'гонки', 'гонок']);
export const wins = pluralize(['перемога', 'перемоги', 'перемог']);
export const drivers = pluralize(['гонщик', 'гонщики', 'гонщиків']);

const PLACE_WORDS = ['перше', 'друге', 'третє', 'четверте', "п'яте"];
const POSITION_WORDS = ['першій', 'другій', 'третій', 'четвертій', "п'ятій"];

/** 1 -> "перше" (місце) */
export const placeWord = (place: number) => PLACE_WORDS[place - 1] ?? `${place}-е`;

/** 2 -> "другій" (позиції) */
export const positionWord = (position: number) => POSITION_WORDS[position - 1] ?? `${position}-й`;

/** ["А", "Б", "В"] -> "А, Б чи В" */
export const joinWith = curry((conjunction: string, items: readonly string[]) =>
	items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`,
);

export const joinWithOr = joinWith('чи');

/** 23456 -> "23,5 с" */
export const formatRaceTime = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} с`;

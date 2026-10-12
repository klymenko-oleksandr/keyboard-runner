// Federation rule: the commentator must never swear. Our own phrases are clean (a test checks them),
// but usernames come from players. So every outgoing text is checked here.
//
// The list holds word ROOTS, not full words. Ukrainian, russian and their Latin spellings,
// because usernames are Latin-only.

/** Unambiguous roots: masked wherever they appear inside a word ("xXfuckXx" too) */
const ROOTS_ANYWHERE = ['fuck', 'cunt', 'хуй', 'хуе', 'хує', 'хуя', 'хуї', 'хуё', 'пизд', 'пізд', 'pizd', 'blyat', 'blyad', 'xuy', 'huy'];

/** Roots that are also the start of normal words ("небагато" contains "еба"), so only at the start of a word */
const ROOTS_AT_WORD_START = [
	'shit',
	'bitch',
	'dick',
	'asshole',
	'бля',
	'сука',
	'суки',
	'сучк',
	'мудак',
	'мудил',
	'підор',
	'підар',
	'пидор',
	'пидар',
	'гандон',
	'залуп',
	'еба',
	'ебл',
	'ебу',
	'ёб',
	'заеб',
	'уеб',
	'suka',
	'blya',
	'mudak',
	'pidor',
	'pidar',
	'gandon',
	'ebat',
	'eban',
	'ebal',
];

const WORD_CHAR = '[\\p{L}\\p{N}_]';
const toAlternatives = (roots: readonly string[]) => roots.join('|');

const PROFANITY = new RegExp(
	`${WORD_CHAR}*(?:${toAlternatives(ROOTS_ANYWHERE)})${WORD_CHAR}*` +
		`|(?<!${WORD_CHAR})(?:${toAlternatives(ROOTS_AT_WORD_START)})${WORD_CHAR}*`,
	'giu',
);

const maskWord = (word: string) => word.charAt(0) + '*'.repeat(word.length - 1);

/** Pure: "big shitstorm" -> "big s********" */
export const maskProfanity = (text: string) => text.replace(PROFANITY, maskWord);

export const containsProfanity = (text: string) => maskProfanity(text) !== text;

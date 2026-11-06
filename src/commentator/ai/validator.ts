// Checks one AI commentary line before it is said. Pure: (text, context) -> { ok, reasons }.
// It checks form, not truth: anything that fails goes to the template line.
// Ported from research/ai-commentator/validator.mjs, where it was tuned on four bench runs.

const WORD = /[\p{L}'’ʼ]+/gu;
const NICK = /[A-Za-z0-9-]*_[A-Za-z0-9_-]*/g;
const DEFAULT_MAX_WORDS = 25;

// Past tense needs the driver's gender in Ukrainian (фінішував / фінішувала). Templates never use it, neither may the AI.
// -ів / -їв are left out on purpose: that is the genitive plural (відсотків, символів, лідерів);
// the few past forms ending in -ів are in PAST_IRREGULAR.
const PAST_MASC = /[аеиоуя]в(ся)?$/u; // фінішував, перетнув, наздогнав, зрівнявся
const PAST_FEM = /[аеиіїоуягкзсх]ла(ся|сь)?$/u; // доїхала, перетнула, запізнилась, встигла, змогла
const PAST_PLURAL = /[аиіїуягкзсх]ли(ся|сь)?$/u; // перетнули, фінішували (not -оли: символи, школи)
const PAST_IRREGULAR = new Set([
	'переміг',
	'зміг',
	'допоміг',
	'встиг',
	'біг',
	'зумів',
	'вмів',
	'хотів',
	'летів',
	'полетів',
	'сидів',
	'сів',
	'ліг',
]);
/** Nouns and adjectives with the same endings */
const NOT_VERBS = new Set([
	'відрив',
	'прорив',
	'розрив',
	'мотив',
	'позитив',
	'архів',
	'київ',
	'лев',
	'рів',
	'сила',
	'мала',
	'ціла',
	'біла',
	'кола',
	'школа',
	'тіла',
	'діла',
	'бджола',
	'смола',
	'весела',
	'гила',
	'сили',
	'школи',
	'кулі',
	'цілі',
	'малі',
	'білі',
	'кили',
]);
const PRONOUNS = new Set(['він', 'вона', 'його', 'її', 'йому', 'їй', 'ним', 'нею', 'нього', 'неї', 'ньому', 'ній']);
/** Forms that agree with the driver's gender */
const GENDERED = new Set([
	'першим',
	'другим',
	'третім',
	'четвертим',
	"п'ятим",
	'останнім',
	'єдиним',
	'першою',
	'другою',
	'третьою',
	'четвертою',
	"п'ятою",
	'останньою',
	'єдиною',
	...PRONOUNS,
	'переможниця',
	'переможниці',
	'суперниця',
	'суперниці',
	'лідерка',
	'дебютантка',
	'гонщиця',
	'королева',
	'чемпіонка',
]);
/** Feminine nouns that reveal a driver's gender (the masculine ones are the accepted generic form); not "суперництво" */
const GENDERED_STEMS = /^(дебютантк|учасниц|переможниц|суперниц(?!тв)|лідерк|гонщиц|чемпіонк|солістк)/u;
/** "duel_ann, яка відстає": a relative pronoun right after a nickname agrees with the driver */
const RELATIVE_AFTER_NICK = /[A-Za-z0-9-]*_[A-Za-z0-9_-]*,?\s+(як(?:ий|а|ого|ої|ому|ій|у|им|ою))(?![\p{L}'])/giu;
/**
 * An ordinal that agrees with a driver, not with a noun after it: "pack_ann перша, pack_dan другий",
 * "solo_ann перша на подіумі", "Другий на старті".
 */
const ORDINAL_ABOUT_DRIVER =
	/(?<![\p{L}'])((?:перш|друг|трет|четверт|п'ят|останн)(?:ий|ій|а|я))(?=\s*(?:[,.!?;:—–-]|$)|\s+[A-Za-z0-9]|\s+(?:на|у|в|з|із|зі)\s)/giu;
const ALLOWED_LATIN = new Set(['WPM']);

export interface ValidationContext {
	/** nicknames in the room */
	names: readonly string[];
	/** every number the model was given */
	numbers: readonly number[];
	maxWords?: number;
	/** Latin words from the data: car brands, "Le Temps" */
	allowedLatin?: readonly string[];
	checkNumbers?: boolean;
	checkLatin?: boolean;
	/** a pre-race driver line: about this driver from start to end, and must name them */
	aboutDriver?: string | null;
}

export interface ValidationResult {
	ok: boolean;
	reasons: string[];
}

const normalize = (word: string) => word.toLowerCase().replace(/[’ʼ]/g, "'");
const nicknamesIn = (text: string): string[] => text.match(NICK) ?? [];
const matchesOf = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map(match => match[1]);

const isPastTense = (word: string) => {
	const w = normalize(word);
	if (w.length < 4 || NOT_VERBS.has(w)) {
		return false;
	}
	return PAST_IRREGULAR.has(w) || PAST_MASC.test(w) || PAST_FEM.test(w) || PAST_PLURAL.test(w);
};

/** Every number in the data, plus gaps between two of them and 100 - x (what is left), ±1 for rounding. Loose on purpose. */
const allowedNumbers = (numbers: readonly number[]) => {
	const allowed = new Set<number>();
	const add = (n: number) => [n - 1, n, n + 1].forEach(x => x >= 0 && allowed.add(Math.round(x)));
	numbers.forEach(a => {
		add(a);
		add(100 - a);
		numbers.forEach(b => a > b && add(a - b));
	});
	return allowed;
};

const checkGender = (line: string, lineAboutDriver: string | null) => {
	// A sentence about the world ("роман виходив частинами") may use the past tense freely.
	// So: sentences that name a driver (or the whole line, for a driver line), plus pronouns in the sentence after one.
	const sentences = line.split(/(?<=[.!?…])\s+/);
	const past: string[] = [];
	const gendered: string[] = [];
	sentences.forEach((sentence, index) => {
		const aboutDriver = Boolean(lineAboutDriver) || nicknamesIn(sentence).length > 0;
		const afterDriver = index > 0 && nicknamesIn(sentences[index - 1]).length > 0;
		if (!aboutDriver && !afterDriver) {
			return;
		}
		const words = (sentence.replace(NICK, ' ').match(WORD) ?? []).filter(word => /\p{Script=Cyrillic}/u.test(word));
		const apostrophes = sentence.replace(/[’ʼ]/g, "'");
		if (aboutDriver) {
			past.push(...words.filter(isPastTense));
			gendered.push(...words.filter(word => GENDERED.has(normalize(word)) || GENDERED_STEMS.test(normalize(word))));
			gendered.push(...matchesOf(apostrophes, ORDINAL_ABOUT_DRIVER), ...matchesOf(sentence, RELATIVE_AFTER_NICK));
		} else {
			// "duel_ann теж фінішує! Другий, але…": pronouns and bare ordinals still point at that driver
			gendered.push(
				...words.filter(word => PRONOUNS.has(normalize(word))),
				...matchesOf(apostrophes, ORDINAL_ABOUT_DRIVER),
			);
		}
	});
	return { past, gendered: [...new Set(gendered)] };
};

export const validateLine = (text: string, context: ValidationContext): ValidationResult => {
	const {
		names,
		numbers,
		maxWords = DEFAULT_MAX_WORDS,
		allowedLatin = [],
		checkNumbers = true,
		checkLatin = true,
		aboutDriver = null,
	} = context;
	const line = text.trim();
	if (!line) {
		return { ok: false, reasons: ['empty'] };
	}
	const reasons: string[] = [];

	const wordCount = line.split(/\s+/).length;
	if (wordCount > maxWords) {
		reasons.push(`too long: ${wordCount} words`);
	}
	if (/https?:|www\./i.test(line)) {
		reasons.push('url');
	}

	// nicknames: exactly as in the room, nobody else
	const nameSet = new Set(names);
	const lowerNames = new Set(names.map(name => name.toLowerCase()));
	nicknamesIn(line)
		.filter(nick => !nameSet.has(nick))
		.forEach(nick =>
			reasons.push(lowerNames.has(nick.toLowerCase()) ? `nickname case: ${nick}` : `unknown driver: ${nick}`),
		);

	const withoutNicks = line.replace(NICK, ' ');
	const latinAllowed = new Set([...ALLOWED_LATIN, ...allowedLatin]);
	const latin = (withoutNicks.match(/[A-Za-z]{2,}/g) ?? []).filter(word => !latinAllowed.has(word));
	if (checkLatin && latin.length) {
		reasons.push(`latin: ${latin.join(', ')}`);
	}

	if (aboutDriver && !nicknamesIn(line).includes(aboutDriver)) {
		reasons.push(`driver not named: ${aboutDriver}`);
	}
	const { past, gendered } = checkGender(line, aboutDriver);
	if (past.length) {
		reasons.push(`past tense: ${past.join(', ')}`);
	}
	if (gendered.length) {
		reasons.push(`gendered: ${gendered.join(', ')}`);
	}

	const allowed = allowedNumbers(numbers);
	const badNumbers = (withoutNicks.match(/\d+/g) ?? []).map(Number).filter(n => !allowed.has(n));
	if (checkNumbers && badNumbers.length) {
		reasons.push(`numbers not in data: ${badNumbers.join(', ')}`);
	}

	return { ok: reasons.length === 0, reasons };
};

/** The context for a payload: every number and every Latin word in it is allowed */
export const contextFromData = (
	data: unknown,
	names: readonly string[],
	options: Omit<ValidationContext, 'names' | 'numbers'> = {},
): ValidationContext => {
	const json = JSON.stringify(data);
	return {
		names,
		numbers: (json.match(/\d+/g) ?? []).map(Number),
		allowedLatin: json.match(/[A-Za-z]{2,}/g) ?? [],
		...options,
	};
};

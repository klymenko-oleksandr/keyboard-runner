// Checks one LLM commentary line before it is broadcast. Pure function: (text, context) -> { ok, reasons }.
// Anything that fails falls back to the template line. Written to be ported to src/commentator/ai/validator.ts.

const WORD = /[\p{L}'’ʼ]+/gu;
const NICK = /[A-Za-z0-9-]*_[A-Za-z0-9_-]*/g;
const MAX_WORDS = 25;

// Past tense needs the driver's gender in Ukrainian: фінішував / фінішувала. Templates never use it, neither may the LLM.
// -ів / -їв are left out on purpose: that is the genitive plural (відсотків, символів, лідерів);
// the few past forms ending in -ів are in PAST_IRREGULAR.
const PAST_MASC = /[аеиоуя]в(ся)?$/u; // фінішував, перетнув, наздогнав, зрівнявся
const PAST_FEM = /[аеиіїоуягкзсх]ла(ся|сь)?$/u; // доїхала, перетнула, запізнилась, встигла, змогла
const PAST_PLURAL = /[аиіїуягкзсх]ли(ся|сь)?$/u; // перетнули, фінішували (not -оли: символи, школи)
const PAST_IRREGULAR = new Set(['переміг', 'зміг', 'допоміг', 'встиг', 'біг', 'зумів', 'вмів', 'хотів', 'летів', 'полетів', 'сидів', 'сів', 'ліг']);
// Nouns and adjectives with the same endings
const NOT_VERBS = new Set([
	'відрив', 'прорив', 'розрив', 'мотив', 'позитив', 'архів', 'київ', 'лев', 'рів',
	'сила', 'мала', 'ціла', 'біла', 'кола', 'школа', 'тіла', 'діла', 'бджола', 'смола', 'весела', 'гила',
	'сили', 'школи', 'кулі', 'цілі', 'малі', 'білі', 'кили',
]);
// Forms that agree with the driver's gender
const GENDERED = new Set([
	'першим', 'другим', 'третім', 'четвертим', "п'ятим", 'останнім', 'єдиним',
	'першою', 'другою', 'третьою', 'четвертою', "п'ятою", 'останньою', 'єдиною',
	'він', 'вона', 'його', 'її', 'йому', 'їй', 'ним', 'нею', 'нього', 'неї', 'ньому', 'ній',
	'переможниця', 'переможниці', 'суперниця', 'суперниці', 'лідерка', 'дебютантка', 'гонщиця', 'королева', 'чемпіонка',
]);
// Feminine nouns that reveal a driver's gender (the masculine ones are the accepted generic form)
const GENDERED_STEMS = /^(дебютантк|учасниц|переможниц|суперниц|лідерк|гонщиц|чемпіонк|солістк)/u;
const PRONOUNS = new Set(['він', 'вона', 'його', 'її', 'йому', 'їй', 'ним', 'нею', 'нього', 'неї', 'ньому', 'ній']);
// "pack_ann перша, pack_dan другий": an ordinal that agrees with a driver, not with a noun after it
// …and "solo_ann перша на подіумі", "Другий на старті": an ordinal followed by a preposition
const ordinalAboutDriver = /(?<![\p{L}'])((?:перш|друг|трет|четверт|п'ят|останн)(?:ий|ій|а|я))(?=\s*(?:[,.!?;:—–-]|$)|\s+[A-Za-z0-9]|\s+(?:на|у|в|з|із|зі)\s)/giu;
const ALLOWED_LATIN = new Set(['WPM']);

const normalize = word => word.toLowerCase().replace(/[’ʼ]/g, "'");

const isPastTense = word => {
	const w = normalize(word);
	if (w.length < 4 || NOT_VERBS.has(w)) return false;
	return PAST_IRREGULAR.has(w) || PAST_MASC.test(w) || PAST_FEM.test(w) || PAST_PLURAL.test(w);
};

/** Every number in the context, plus differences (gaps) and 100 - x (what is left), ±1 for rounding */
const allowedNumbers = numbers => {
	const allowed = new Set();
	const add = n => [n - 1, n, n + 1].forEach(x => x >= 0 && allowed.add(Math.round(x)));
	numbers.forEach(a => {
		add(a);
		add(100 - a);
		numbers.forEach(b => a > b && add(a - b));
	});
	return allowed;
};

/**
 * @param {string} text the model's line
 * @param {{ names: string[], numbers: number[], maxWords?: number, allowedLatin?: string[], checkNumbers?: boolean, checkLatin?: boolean }} context
 *   nicknames in the room, numbers the model was given; Latin words from the data (car brands, "Le Temps") are allowed.
 *   Fillers talk about the world, so their numbers and Latin words are left to the judge.
 */
export const validateLine = (
	text,
	{ names, numbers, maxWords = MAX_WORDS, allowedLatin = [], checkNumbers = true, checkLatin = true, aboutDriver: lineAboutDriver = null },
) => {
	const reasons = [];
	const line = text.trim();
	if (!line) return { ok: false, reasons: ['empty'] };

	const words = line.split(/\s+/);
	if (words.length > maxWords) reasons.push(`too long: ${words.length} words`);
	if (/https?:|www\./i.test(line)) reasons.push('url');

	// nicknames: exactly as in the room, nobody else
	const nameSet = new Set(names);
	const lowerNames = new Map(names.map(name => [name.toLowerCase(), name]));
	for (const nick of line.match(NICK) ?? []) {
		if (nameSet.has(nick)) continue;
		reasons.push(lowerNames.has(nick.toLowerCase()) ? `nickname case: ${nick}` : `unknown driver: ${nick}`);
	}

	const withoutNicks = line.replace(NICK, ' ');
	const latinAllowed = new Set([...ALLOWED_LATIN, ...allowedLatin]);
	const latin = (withoutNicks.match(/[A-Za-z]{2,}/g) ?? []).filter(word => !latinAllowed.has(word));
	if (checkLatin && latin.length) reasons.push(`latin: ${latin.join(', ')}`);

	// Gender rules are about drivers. A sentence about the world ("Миша з'явилася в 1968 році", "роман виходив частинами")
	// may use the past tense freely. So check only sentences that name a driver, plus pronouns in the sentence right after one.
	const sentences = line.split(/(?<=[.!?…])\s+/);
	const mentionsDriver = sentence => (sentence.match(NICK) ?? []).length > 0;
	const past = [];
	const gendered = [];
	sentences.forEach((sentence, index) => {
		// a pre-race driver line is about that driver from start to end, named or not
		const aboutDriver = Boolean(lineAboutDriver) || mentionsDriver(sentence);
		const afterDriver = index > 0 && mentionsDriver(sentences[index - 1]);
		if (!aboutDriver && !afterDriver) return;
		const words = (sentence.replace(NICK, ' ').match(WORD) ?? []).filter(word => /\p{Script=Cyrillic}/u.test(word));
		if (aboutDriver) {
			past.push(...words.filter(isPastTense));
			gendered.push(...words.filter(word => GENDERED.has(normalize(word)) || GENDERED_STEMS.test(normalize(word))));
			gendered.push(...[...sentence.replace(/[’ʼ]/g, "'").matchAll(ordinalAboutDriver)].map(match => match[1]));
		} else {
			// "duel_ann теж фінішує! Другий, але…": pronouns and bare ordinals still point at that driver
			gendered.push(...words.filter(word => PRONOUNS.has(normalize(word))));
			gendered.push(...[...sentence.replace(/[’ʼ]/g, "'").matchAll(ordinalAboutDriver)].map(match => match[1]));
		}
	});
	if (lineAboutDriver && !(line.match(NICK) ?? []).includes(lineAboutDriver)) reasons.push(`driver not named: ${lineAboutDriver}`);
	if (past.length) reasons.push(`past tense: ${past.join(', ')}`);
	if (gendered.length) reasons.push(`gendered: ${[...new Set(gendered)].join(', ')}`);

	const allowed = allowedNumbers(numbers);
	const badNumbers = (withoutNicks.match(/\d+/g) ?? []).map(Number).filter(n => !allowed.has(n));
	if (checkNumbers && badNumbers.length) reasons.push(`numbers not in data: ${badNumbers.join(', ')}`);

	return { ok: reasons.length === 0, reasons };
};

/** Context from any data object: every number and every Latin word in it */
export const contextFromData = (data, names, options = {}) => {
	const json = JSON.stringify(data);
	return { names, numbers: (json.match(/\d+/g) ?? []).map(Number), allowedLatin: json.match(/[A-Za-z]{2,}/g) ?? [], ...options };
};

/** Context for a bench moment: names in the race, every number in the snapshot */
export const contextFromSnapshot = snapshot => ({
	names: snapshot.standings.map(standing => standing.name),
	numbers: (JSON.stringify(snapshot).match(/\d+/g) ?? []).map(Number),
});

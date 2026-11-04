// LLM judge for commentary lines: is the line true to the race data, about the event, coherent, gender-neutral, good Ukrainian?
// Judges the AI line AND the template line for every moment. Templates are built from the same data, so the judge
// should find (almost) no factual errors there: the template score is the judge's own false-alarm rate.
//
// usage: RACES=races-v3 node --env-file=.env judge.mjs bench-claude-haiku-5-5-v3.json
//        JUDGE_MODEL=claude-opus-5-5 ...   (default claude-sonnet-5-5)
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadMoments } from './moments.mjs';

const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'claude-sonnet-5-5';
const PRICES = { 'claude-sonnet-5-5': { in: 2, out: 10 }, 'claude-opus-5-5': { in: 4, out: 20 } };
const benchFile = process.argv[2];
if (!benchFile) throw new Error('usage: node judge.mjs bench-<model>-<prompt>.json');

const { summary: benchSummary, results } = JSON.parse(readFileSync(benchFile, 'utf8'));
// fast-moment benches carry no data (it is rebuilt from the recordings); slot benches carry their own context
const isSlots = benchSummary.kind === 'slots';
const moments = isSlots
	? results.map(r => ({ type: r.type, subject: null, snapshot: r.context }))
	: loadMoments();
if (moments.length !== results.length) throw new Error(`${results.length} results vs ${moments.length} moments: wrong RACES dir?`);

const SYSTEM = `You review live commentary lines for a multiplayer typing race (players type a text; whoever types it all first wins).
The commentary is in Ukrainian. Driver gender is unknown, so lines must not reveal it.
You get the race data at the moment the line was said, and the line. Judge only against the data.
Known context that is NOT in the data and is fine to mention: the commentator is Таб Шифтович, the venue is the «Чайка» track (автодром «Чайка»).
In standings, "progress" is a percentage of the text (0-100), not characters. "charsLeft" in eventFacts is characters.

Return ONLY a JSON object, no prose:
{
  "factual": true | false,        // every claim (positions, who leads, who passed whom, finished or not, places, times, numbers, records) agrees with the data. Vague but not wrong claims ("дихає в спину") are fine. Rounding is fine.
  "factualIssue": string | null,  // if false: the wrong claim, quoted, and what the data says
  "aboutEvent": true | false,     // the line is about the event given (its eventFacts / main driver), not something else
  "coherent": true | false,       // no self-contradiction inside the line
  "genderNeutral": true | false,  // no past tense or other forms that reveal a driver's gender (першим/першою, фінішував/фінішувала, він/вона)
  "languageOk": true | false,     // natural, grammatical Ukrainian; no russisms, no made-up words
  "languageIssue": string | null,
  "worldFactOk": true | false | null  // only for claims about the real world that are NOT in the data (history of typewriters, keyboards...): true if correct, false if wrong or doubtful, null if there are none
}
A line may contain several lines of commentary (a pre-race block); judge all of them together. For a block, "aboutEvent" means it does the task: greets, presents every driver from the data, mentions the rivalry and the book if they are in the data.`;

const client = new Anthropic();
let cost = 0;

const judge = async (moment, line) => {
	const message = await client.messages.create({
		model: JUDGE_MODEL,
		max_tokens: 3000,
		system: SYSTEM,
		messages: [
			{
				role: 'user',
				content: `<event>${moment.type}${moment.subject ? `, main driver: ${moment.subject}` : ''}</event>\n<race>\n${JSON.stringify(moment.snapshot)}\n</race>\n<line>${line}</line>`,
			},
		],
	});
	const price = PRICES[JUDGE_MODEL] ?? PRICES['claude-sonnet-5-5'];
	cost += (message.usage.input_tokens * price.in + message.usage.output_tokens * price.out) / 1e6;
	const text = message.content.filter(block => block.type === 'text').map(block => block.text).join('');
	try {
		return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
	} catch {
		return { parseError: text.slice(0, 300) };
	}
};

const verdicts = [];
for (const [i, result] of results.entries()) {
	const moment = moments[i];
	const aiLine = result.outcome === 'ai' ? result.llm : null;
	const [ai, template] = await Promise.all([aiLine ? judge(moment, aiLine) : null, judge(moment, result.template)]);
	verdicts.push({ type: result.type, run: result.run, ai: aiLine && { line: aiLine, ...ai }, template: { line: result.template, ...template } });
	const mark = v => (!v ? '—' : v.parseError ? '??' : v.factual && v.coherent ? 'ok' : 'WRONG');
	console.log(`${result.type.padEnd(11)} ai:${mark(ai).padEnd(5)} tpl:${mark(template).padEnd(5)} ${aiLine ?? '(fallback)'}${ai && !ai.factual ? `\n             -> ${ai.factualIssue}` : ''}`);
}

const rate = (side, key) => {
	const judged = verdicts.map(v => v[side]).filter(v => v && !v.parseError);
	return { bad: judged.filter(v => v[key] === false).length, of: judged.length };
};
const keys = ['factual', 'aboutEvent', 'coherent', 'genderNeutral', 'languageOk', 'worldFactOk'];
const summary = {
	bench: benchFile,
	judge: JUDGE_MODEL,
	ai: Object.fromEntries(keys.map(key => [key, rate('ai', key)])),
	...(isSlots && {
		aiBySlot: Object.fromEntries(
			[...new Set(verdicts.map(v => v.type))].map(type => {
				const judged = verdicts.filter(v => v.type === type && v.ai && !v.ai.parseError).map(v => v.ai);
				const bad = judged.filter(v => v.factual === false || v.coherent === false || v.worldFactOk === false).length;
				return [type, { wrong: bad, of: judged.length, language: judged.filter(v => v.languageOk === false).length }];
			}),
		),
	}),
	template: Object.fromEntries(keys.map(key => [key, rate('template', key)])),
	parseErrors: verdicts.filter(v => v.ai?.parseError || v.template.parseError).length,
	judgeCost: Number(cost.toFixed(3)),
};
const tag = benchFile.replace(/^bench-|\.json$/g, '');
writeFileSync(`judge-${tag}.json`, JSON.stringify({ summary, benchSummary, verdicts }, null, 2));
// sheet for a human spot check of the judge
writeFileSync(
	`judge-${tag}.md`,
	verdicts
		.map((v, i) => `${i + 1}. [${v.type}] ${v.ai ? `AI ${v.ai.factual && v.ai.coherent ? 'ok' : 'WRONG'}: ${v.ai.line}${v.ai.factualIssue ? `\n   judge: ${v.ai.factualIssue}` : ''}` : 'AI: fallback'}\n   template ${v.template.factual ? 'ok' : 'WRONG'}: ${v.template.line}${v.template.factualIssue ? `\n   judge: ${v.template.factualIssue}` : ''}`)
		.join('\n\n'),
);
console.log(JSON.stringify(summary, null, 2));

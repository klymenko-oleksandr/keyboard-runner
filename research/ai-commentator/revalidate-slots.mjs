// Re-checks a slots bench with the current validator and per-slot word limits, no API calls.
// Writes bench-slots-<model>-rv.json (same shape, new outcomes) for judge.mjs.
// Limits follow the templates: the longest template line per slot, plus some room.
//
// usage: node revalidate-slots.mjs bench-slots-claude-haiku-5-5.json
import { readFileSync, writeFileSync } from 'node:fs';
import { contextFromData, validateLine } from './validator.mjs';

const MAX_WORDS = { prerace: 40, status: 45, filler: 40, results: 70 };
const DEADLINE_MS = { prerace: 5000, status: 3500, filler: 3500, results: 3500 };
const WORLD_TALK = { filler: { checkNumbers: false, checkLatin: false } };

const file = process.argv[2] ?? 'bench-slots-claude-haiku-5-5.json';
const bench = JSON.parse(readFileSync(file, 'utf8'));

// fillers were benched without the drivers' names; take them from the same race
const namesByRace = {};
bench.results.filter(r => r.names?.length).forEach(r => (namesByRace[r.race] = r.names));

const before = {};
const after = {};
const results = bench.results.map(r => {
	const names = r.names?.length ? r.names : namesByRace[r.race] ?? [];
	const context = contextFromData(r.context, names, { maxWords: MAX_WORDS[r.type], ...WORLD_TALK[r.type] });
	const reasons = r.lines.flatMap(line => validateLine(line, context).reasons.map(reason => `${reason} in «${line.slice(0, 40)}…»`));
	if (r.type === 'prerace') {
		const expected = 1 + r.context.drivers.length + (r.context.rivalry ? 1 : 0) + (r.context.track ? 1 : 0);
		if (r.lines.length < expected - 1 || r.lines.length > expected + 1) reasons.push(`lines: ${r.lines.length}, expected about ${expected}`);
	}
	// A pre-race block can go out line by line: what matters is when the first line is ready
	const firstLineMs = r.ttftMs === null ? r.elapsedMs : Math.round(r.ttftMs + (r.totalMs - r.ttftMs) / Math.max(1, r.lines.length));
	const deadlineHit = r.type === 'prerace' ? firstLineMs + (r.attempts === 2 ? r.elapsedMs - r.totalMs : 0) > DEADLINE_MS[r.type] : r.elapsedMs > DEADLINE_MS[r.type];
	const outcome = reasons.length ? 'fallback:invalid' : deadlineHit ? 'fallback:timeout' : 'ai';
	for (const [counts, value] of [[before, r.outcome], [after, outcome]]) {
		counts[r.type] ??= { n: 0, ai: 0 };
		counts[r.type].n += 1;
		counts[r.type].ai += value === 'ai' ? 1 : 0;
	}
	return { ...r, names, outcomeBefore: r.outcome, outcome, reasons, firstLineMs };
});

const show = counts => Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, `${v.ai}/${v.n}`]));
console.log('shown as AI, before:', show(before));
console.log('shown as AI, after: ', show(after));
const total = counts => Object.values(counts).reduce((a, v) => [a[0] + v.ai, a[1] + v.n], [0, 0]).join('/');
console.log('total before', total(before), 'after', total(after));
const firstLines = results.filter(r => r.type === 'prerace').map(r => r.firstLineMs).sort((a, b) => a - b);
console.log('pre-race first line ready (estimate), ms:', firstLines.join(' '));
console.log('\nstill rejected:');
results.filter(r => r.outcome !== 'ai').forEach(r => console.log(`  ${r.type} ${r.outcome} ${r.reasons.join('; ').slice(0, 220)}`));

writeFileSync(file.replace('.json', '-rv.json'), JSON.stringify({ summary: { ...bench.summary, revalidated: true }, results }, null, 2));

// Runs the validator over saved bench results (no API calls): how many lines would fall back to templates, and why.
// usage: node revalidate.mjs [bench-claude-haiku-5-5.json ...]   (default: every bench-*.json here)
import { readFileSync, readdirSync } from 'node:fs';
import { loadMoments } from './moments.mjs';
import { contextFromSnapshot, validateLine } from './validator.mjs';

const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync('.').filter(f => /^bench-.*\.json$/.test(f));
const moments = loadMoments();
const verbose = process.env.VERBOSE === '1';

for (const file of files) {
	const { summary, results } = JSON.parse(readFileSync(file, 'utf8'));
	if (results.length !== moments.length) {
		console.log(`${file}: ${results.length} results vs ${moments.length} moments, skipped`);
		continue;
	}
	const checked = results.map((result, i) => ({ ...result, ...validateLine(result.llm, contextFromSnapshot(moments[i].snapshot)) }));
	const rejected = checked.filter(r => !r.ok);
	const byReason = {};
	rejected.forEach(r => r.reasons.forEach(reason => (byReason[reason.split(':')[0]] = (byReason[reason.split(':')[0]] ?? 0) + 1)));
	const byType = {};
	checked.forEach(r => {
		byType[r.type] ??= { total: 0, fallback: 0 };
		byType[r.type].total += 1;
		byType[r.type].fallback += r.ok ? 0 : 1;
	});

	console.log(`\n=== ${summary.model}: ${rejected.length}/${checked.length} lines fall back (${Math.round((100 * rejected.length) / checked.length)}%)`);
	console.log('by reason:', byReason);
	console.log('by slot:', Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, `${v.fallback}/${v.total}`])));
	if (verbose) {
		console.log('\n-- rejected');
		rejected.forEach(r => console.log(`  [${r.reasons.join('; ')}] ${r.llm}`));
		console.log('\n-- accepted');
		checked.filter(r => r.ok).forEach(r => console.log(`  ${r.llm}`));
	}
}

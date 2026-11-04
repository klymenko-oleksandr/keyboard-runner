// Summarises recorded races: comment timeline, gaps, bursts, lead changes vs announced overtakes.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const files = readdirSync('races').filter(f => f.endsWith('.jsonl')).sort();
const summary = [];
let transcript = '';

for (const file of files) {
	const ev = readFileSync(`races/${file}`, 'utf8').trim().split('\n').map(JSON.parse);
	const go = ev.find(e => e.event === 'meta' && e.event === 'go') ?? ev.find(e => e.event === 'go');
	const goT = go.t;
	const textLength = ev.find(e => e.event === 'text').data.textLength;
	const end = ev.find(e => e.event === 'game:finished');
	const comments = ev.filter(e => e.event === 'commentator:comment');
	const prog = ev.filter(e => e.event === 'game:progress-updated');

	// leader tracking from progress events
	const p = {};
	let leader = null;
	let leadChanges = 0;
	for (const e of prog) {
		p[e.data.username] = e.data.progress;
		const top = Object.entries(p).sort((a, b) => b[1] - a[1])[0][0];
		if (leader && top !== leader && e.t - goT > 5000) leadChanges++;
		leader = top;
	}

	const inRace = comments.filter(c => c.t >= goT && c.t <= end.t);
	const gaps = inRace.slice(1).map((c, i) => c.t - inRace[i].t);
	const before = comments.filter(c => c.t < goT);
	const words = comments.map(c => c.data.text.split(/\s+/).length);
	const byType = {};
	comments.forEach(c => (byType[c.data.type] = (byType[c.data.type] ?? 0) + 1));

	summary.push({
		race: file.replace('.jsonl', ''),
		players: Object.keys(p).length,
		textLength,
		raceSeconds: +((end.t - goT) / 1000).toFixed(1),
		progressEventsPerSec: +(prog.length / ((end.t - goT) / 1000)).toFixed(1),
		comments: comments.length,
		beforeStart: before.length,
		beforeStartSpanMs: before.length ? before.at(-1).t - before[0].t : 0,
		inRace: inRace.length,
		minGapMs: gaps.length ? Math.min(...gaps) : null,
		gapsUnder2s: gaps.filter(g => g < 2000).length,
		leadChangesAfter5s: leadChanges,
		overtakesAnnounced: byType.overtake ?? 0,
		avgWords: +(words.reduce((a, b) => a + b, 0) / words.length).toFixed(1),
		maxWords: Math.max(...words),
		byType,
	});

	transcript += `\n### ${file}\n`;
	for (const c of comments) transcript += `[${((c.t - goT) / 1000).toFixed(1).padStart(6)}s] ${c.data.type.padEnd(11)} ${c.data.text}\n`;
}

writeFileSync('summary.json', JSON.stringify(summary, null, 2));
writeFileSync('transcript.md', transcript);
console.table(summary.map(({ byType, ...s }) => s));

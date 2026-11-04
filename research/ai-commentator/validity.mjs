// For each overtake / approaching comment: how long the claim stays true
// (the named driver keeps the position the comment states). That is the latency budget for an LLM line.
import { readFileSync, readdirSync } from 'node:fs';

const windows = [];
for (const file of readdirSync('races').filter(f => f.endsWith('.jsonl'))) {
	const ev = readFileSync(`races/${file}`, 'utf8').trim().split('\n').map(JSON.parse);
	const prog = ev.filter(e => e.event === 'game:progress-updated');
	const end = ev.find(e => e.event === 'game:finished').t;
	const order = (state, prevOrder) =>
		Object.keys(state).sort((a, b) => state[b] - state[a] || prevOrder.indexOf(a) - prevOrder.indexOf(b));

	// replay standings at every progress event
	const timeline = [];
	const state = {};
	let prev = [];
	for (const e of prog) {
		state[e.data.username] = e.data.finished ? 1000 + (100 - timeline.length / 1e6) : e.data.progress;
		prev = order(state, prev);
		timeline.push({ t: e.t, order: prev });
	}
	const positionAt = (name, t) => {
		let last = null;
		for (const s of timeline) {
			if (s.t > t) break;
			last = s;
		}
		return last ? last.order.indexOf(name) + 1 : null;
	};

	for (const c of ev.filter(e => e.event === 'commentator:comment' && e.data.type === 'overtake')) {
		const name = c.data.text.match(/(\w+_\w+) (обходить|випереджає|проривається)/)?.[1];
		if (!name) continue;
		const pos = positionAt(name, c.t);
		const change = timeline.find(s => s.t > c.t && s.order.indexOf(name) + 1 !== pos);
		windows.push({ race: file, ms: (change ? change.t : end) - c.t, censored: !change });
	}
}
windows.sort((a, b) => a.ms - b.ms);
const q = p => windows[Math.floor(p * (windows.length - 1))].ms;
console.log('overtake comments:', windows.length);
console.log('claim stays true, ms: min', windows[0].ms, 'p25', q(0.25), 'median', q(0.5), 'p75', q(0.75));
console.log('share invalid within 1s:', (windows.filter(w => w.ms < 1000).length / windows.length).toFixed(2),
	'within 2s:', (windows.filter(w => w.ms < 2000).length / windows.length).toFixed(2),
	'within 3s:', (windows.filter(w => w.ms < 3000).length / windows.length).toFixed(2));
console.log(windows.map(w => w.ms).join(' '));

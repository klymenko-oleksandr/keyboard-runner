// Builds the benchmark moments from recorded races: every time the template commentator spoke about
// an overtake, a finish approach, a finish or the results, with the race snapshot at that instant.
import { readFileSync, readdirSync } from 'node:fs';

const TYPES = new Set(['overtake', 'approaching', 'finish', 'results']);

const seconds = ms => (ms / 1000).toFixed(1).replace('.', ',');

/** The template payload in a model-friendly shape: the facts of this event, nothing about wording */
const toEventFacts = (type, payload) => {
	if (!payload) return undefined;
	switch (type) {
		case 'overtake':
			return { driver: payload.username, overtaken: payload.overtaken, newPosition: payload.position };
		case 'approaching':
			return { driver: payload.username, charsLeft: payload.charsLeft, firstOnFinishStraight: payload.isFirst };
		case 'finish':
			return {
				driver: payload.username,
				place: payload.place,
				timeSeconds: seconds(payload.finishTimeMs),
				lastToFinish: payload.isLast,
				previousFinisher: payload.previous ? { driver: payload.previous.username, gapSeconds: seconds(payload.previous.gapMs) } : null,
				speed: payload.speed,
			};
		case 'results':
			return {
				results: payload.results.map(r => ({
					place: r.place,
					driver: r.username,
					finished: r.finished,
					timeSeconds: r.finishTimeMs === null ? null : seconds(r.finishTimeMs),
					wpm: r.wpm,
					progress: r.progress,
				})),
				winnerWinsInARow: payload.winnerStreak,
				comeback: payload.comeback ? { driver: payload.comeback.username, worstPosition: payload.comeback.worstPosition, place: payload.comeback.place } : null,
			};
		default:
			return undefined;
	}
};

export const loadMoments = (dir = process.env.RACES ?? 'races') => {
	const moments = [];
	for (const file of readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort()) {
		const ev = readFileSync(`${dir}/${file}`, 'utf8').trim().split('\n').map(JSON.parse);
		const goT = ev.find(e => e.event === 'go').t;
		const textLength = ev.find(e => e.event === 'text').data.textLength;
		const end = ev.find(e => e.event === 'game:finished');
		const state = {};
		const said = [];
		const timeline = [];
		let order = [];
		for (const e of ev) {
			if (e.event === 'game:progress-updated') {
				state[e.data.username] = { progress: e.data.progress, finished: e.data.finished };
				order = Object.keys(state).sort((a, b) => state[b].progress - state[a].progress || order.indexOf(a) - order.indexOf(b));
				timeline.push({ t: e.t, order: [...order] });
			}
			if (e.event !== 'commentator:comment') continue;
			const { type, text } = e.data;
			if (TYPES.has(type)) {
				// the recording only has rounded percentages; the server ranks by characters. On an overtake trust the server.
				const facts = toEventFacts(type, e.data.payload);
				if (type === 'overtake' && facts) {
					order = order.filter(name => name !== facts.driver);
					order.splice(facts.newPosition - 1, 0, facts.driver);
				}
				const standings = order.map((name, i) => ({ position: i + 1, name, progress: state[name].progress, finished: state[name].finished }));
				const snapshot = {
					event: type,
					secondsElapsed: Math.round((e.t - goT) / 1000),
					secondsLeft: Math.max(0, 60 - Math.round((e.t - goT) / 1000)),
					textLength,
					standings,
					// what the template engine knows about the event, without its wording
					// recordings with payloads (races-v3/) carry the template's facts; older ones only the final results
				eventFacts:
					facts ??
					(type === 'results' ? end.data.results.map(r => ({ place: r.place, name: r.username, wpm: r.wpm, finished: r.finished })) : undefined),
				};
				const subject = e.data.payload?.username ?? text.match(/[a-z]+(?:r2)?_[a-z]+/)?.[0] ?? null;
				moments.push({ race: file, t: e.t, type, subject, templateText: text, snapshot, said: said.slice(-3), timeline, end: end.t });
			}
			said.push(text);
		}
	}
	return moments;
};

export const positionAt = (moment, name, t) => {
	let last = null;
	for (const s of moment.timeline) {
		if (s.t > t) break;
		last = s;
	}
	return last ? last.order.indexOf(name) + 1 : null;
};

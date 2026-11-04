// The slow slots ADR-001 gives to the LLM, built from races-v3 recordings (comments carry the template payload):
// pre-race block (greeting + lineup + rivalry + track), 30 s status, filler, results recap.
import { readFileSync, readdirSync } from 'node:fs';

const seconds = ms => (ms / 1000).toFixed(1).replace('.', ',');

const describeDriver = ({ driver, gridNumber }) => ({
	gridNumber,
	username: driver.username,
	// colour is already in the locative case: "на зеленому Aston Martin"
	car: { brand: driver.car.brand, colorLocative: driver.car.color, number: driver.car.number },
	races: driver.races,
	wins: driver.wins,
	bestWpm: driver.bestWpm,
	winsInARow: driver.winStreak,
	debut: driver.races === 0,
});

// v4 (spec Revision 3): names that cannot be misread. `races: 1` was read as "the first race".
const describeDriverV4 = ({ driver, gridNumber }) => ({
	gridNumber,
	username: driver.username,
	car: { brand: driver.car.brand, colorLocative: driver.car.color, number: driver.car.number },
	racesBefore: driver.races,
	winsBefore: driver.wins,
	bestWpm: driver.races === 0 ? null : driver.bestWpm,
	winsInARow: driver.winStreak,
	debut: driver.races === 0,
});

export const loadSlots = (dir = process.env.RACES ?? 'races-v3', { version = 'v3' } = {}) => {
	const v4 = version === 'v4';
	const slots = [];
	for (const file of readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort()) {
		const ev = readFileSync(`${dir}/${file}`, 'utf8').trim().split('\n').map(JSON.parse);
		const goT = ev.find(e => e.event === 'go').t;
		const comments = ev.filter(e => e.event === 'commentator:comment');
		if (!comments.every(c => c.data.payload)) throw new Error(`${file} has no payloads: record with RECORD_PAYLOADS=1`);

		// 1. pre-race block: everything said before lights out
		const pre = comments.filter(c => c.t < goT);
		const byType = type => pre.filter(c => c.data.type === type).map(c => c.data.payload);
		const greeting = byType('greeting')[0];
		const rivalry = byType('rivalry')[0] ?? null;
		const track = byType('track')[0] ?? null;
		const drivers = byType('lineup').map(v4 ? describeDriverV4 : describeDriver);
		slots.push({
			race: file,
			slot: 'prerace',
			names: drivers.map(d => d.username),
			context: {
				roomName: greeting.roomName,
				weather: greeting.weather,
				drivers,
				rivalry: rivalry && { drivers: rivalry.drivers, meetings: rivalry.record.meetings, wins: rivalry.record.wins, lastWinner: rivalry.record.lastWinner },
				track: track && { title: track.book.titleUk, author: track.book.authorUk, fact: track.book.fact },
			},
			template: pre.map(c => c.data.text),
		});

		const said = text => comments.filter(c => c.t <= text.t).slice(-3).map(c => c.data.text);
		for (const c of comments.filter(c => c.t >= goT)) {
			const { type, payload } = c.data;
			const base = { race: file, template: [c.data.text], said: said(c).slice(0, -1) };
			if (type === 'status') {
				const leader = payload.standings[0];
				slots.push({
					...base,
					slot: 'status',
					names: payload.standings.map(s => s.username),
					context: {
						secondsLeft: payload.secondsLeft,
						textLength: payload.textLength,
						standings: payload.standings.map((s, i) => ({
							position: i + 1,
							username: s.username,
							percent: Math.floor((100 * s.typedChars) / payload.textLength),
							charsBehindLeader: leader.typedChars - s.typedChars,
							finished: s.finished,
						})),
					},
				});
			}
			if (type === 'filler') {
				slots.push({
					...base,
					slot: 'filler',
					names: [],
					context: { secondsElapsed: Math.round((c.t - goT) / 1000) },
				});
			}
			if (type === 'results') {
				// v4: the finish lines' speed news, so the model does not have to dig it out of earlier lines
				const speedNews = new Map(
					comments.filter(f => f.data.type === 'finish' && f.data.payload.speed).map(f => [f.data.payload.username, f.data.payload.speed]),
				);
				const debutAt = new Set(drivers.filter(d => d.debut).map(d => d.username));
				slots.push({
					...base,
					slot: 'results',
					names: payload.results.map(r => r.username),
					context: {
						everyoneFinished: payload.results.every(r => r.finished),
						results: payload.results.map(r => ({
							place: r.place,
							username: r.username,
							finished: r.finished,
							timeSeconds: r.finishTimeMs === null ? null : seconds(r.finishTimeMs),
							wpm: r.wpm,
							percent: r.progress,
							...(v4 && {
								debut: debutAt.has(r.username),
								personalBest: speedNews.get(r.username)?.kind === 'personalBest' ? { previous: speedNews.get(r.username).previousBest } : null,
							}),
						})),
						winnerWinsInARow: payload.winnerStreak,
						comeback: payload.comeback && { username: payload.comeback.username, worstPosition: payload.comeback.worstPosition, place: payload.comeback.place },
					},
				});
			}
		}
	}
	return slots;
};

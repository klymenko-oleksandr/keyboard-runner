// Runs bot races against a local keyboard-runner server and records every server event as JSONL.
// usage: node recorder.mjs <scenario> <outFile>
import { io } from 'socket.io-client';
import { writeFileSync } from 'node:fs';

const URL = 'http://localhost:3002';
const SCENARIOS = {
	// close pack: lots of overtakes
	pack: [62, 65, 67, 70, 73],
	// spread field
	spread: [40, 75, 110],
	// duel of equals: photo finish candidates
	duel: [80, 81],
	// slow field: timer ends before everyone finishes
	slow: [30, 36, 44, 52],
	solo: [70],
};

const [scenario, outFile, tag = ''] = process.argv.slice(2);
const wpms = SCENARIOS[scenario];
const room = `${scenario}${tag}-${Date.now() % 100000}`;
const names = wpms.map((_, i) => `${scenario}_${['ann', 'bob', 'cat', 'dan', 'eve'][i]}`);
const events = [];
let t0 = Date.now();
const log = (who, event, data) => events.push({ t: Date.now() - t0, who, event, data });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

const connect = name =>
	new Promise((resolve, reject) => {
		const s = io(URL, { auth: { username: name, sessionId: name }, transports: ['websocket'] });
		s.on('connect', () => resolve(s));
		s.on('connect_error', reject);
	});

const sockets = [];
for (const name of names) sockets.push(await connect(name));

// observer = first socket records everything the room sees
const observer = sockets[0];
['room:users-updated', 'game:countdown-started', 'game:started', 'game:progress-updated', 'game:finished', 'commentator:comment'].forEach(
	ev => observer.on(ev, data => log('room', ev, data)),
);

await new Promise(res => observer.emit('room:create', room, res));
for (const s of sockets.slice(1)) await new Promise(res => s.emit('room:join', room, res));

let textLength = 0;
const started = new Promise(resolve => observer.once('game:started', resolve));
observer.once('game:countdown-started', async ({ textId }) => {
	t0 = Date.now();
	const r = await fetch(`${URL}/game/texts/${textId}`).then(r => r.json());
	textLength = r.text.length;
	log('meta', 'text', { textId, textLength });
});
const finished = new Promise(resolve => observer.once('game:finished', resolve));

sockets.forEach(s => s.emit('player:set-ready', true));
await started;
log('meta', 'go', {});

// each bot types with its own speed, jitter and occasional "mistake" pauses
const typists = sockets.map(async (s, i) => {
	const cps = (wpms[i] * 5) / 60;
	let typed = 0;
	let done = false;
	finished.then(() => (done = true));
	await sleep(rand(200, 600)); // reaction time
	while (!done && typed < textLength) {
		let delay = rand(0.6, 1.4) * (1000 / cps);
		if (Math.random() < 0.04) delay += rand(400, 1800); // a typo to fix
		await sleep(delay);
		typed += 1;
		s.emit('game:update-progress', typed);
	}
});

await finished;
await Promise.all(typists);
await sleep(500);
sockets.forEach(s => s.disconnect());
writeFileSync(outFile, events.map(e => JSON.stringify(e)).join('\n') + '\n');
console.log(`${scenario}${tag}: ${events.length} events -> ${outFile}`);
process.exit(0);

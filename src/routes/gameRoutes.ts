import { Router } from 'express';
import path from 'path';
import { HTML_FILES_PATH } from '../config';
import { texts } from '../data';
import { MAXIMUM_USERS_FOR_ONE_ROOM, SECONDS_FOR_GAME, SECONDS_TIMER_BEFORE_START_GAME } from '../socket/config';
import { COMMENTATOR_NAME } from '../commentator/config';

const router = Router();

router.get('/', (req, res) => {
	const page = path.join(HTML_FILES_PATH, 'game.html');
	res.sendFile(page);
});

// REST endpoint: the socket tells WHICH text (id), HTTP delivers the text itself
router.get('/texts/:id', (req, res) => {
	const id = Number(req.params.id);

	if (!Number.isInteger(id) || id < 0 || id >= texts.length) {
		res.status(404).json({ error: 'Text not found' });
		return;
	}

	res.json({ id, text: texts[id] });
});

// Game rules for the "Race briefing" block (works before login, so it is HTTP, not a socket event)
router.get('/config', (req, res) => {
	res.json({
		maxUsers: MAXIMUM_USERS_FOR_ONE_ROOM,
		countdownSeconds: SECONDS_TIMER_BEFORE_START_GAME,
		gameSeconds: SECONDS_FOR_GAME,
		commentatorName: COMMENTATOR_NAME,
	});
});

export default router;

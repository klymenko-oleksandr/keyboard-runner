import { Router } from 'express';
import path from 'path';
import { HTML_FILES_PATH } from '../config';
import { texts } from '../data';

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

export default router;

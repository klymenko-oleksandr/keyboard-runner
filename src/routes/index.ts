import path from 'path';
import { Express } from 'express';
import loginRoutes from './loginRoutes';
import gameRoutes from './gameRoutes';
import { HTML_FILES_PATH } from '../config';

export default (app: Express) => {
	app.use('/login', loginRoutes);
	app.use('/game', gameRoutes);
	// All UI components on one page (same CSS as the game)
	app.get('/styleguide', (req, res) => res.sendFile(path.join(HTML_FILES_PATH, 'styleguide.html')));
};

import path from 'path';

export const STATIC_PATH = path.join(__dirname, '..', 'public');
export const HTML_FILES_PATH = path.join(STATIC_PATH, 'html');

// Hosting platforms (Render, Railway, ...) inject the port via env; locally it is 3002.
export const PORT = Number(process.env.PORT) || 3002;

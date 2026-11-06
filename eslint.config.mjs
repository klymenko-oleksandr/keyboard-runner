// ESLint flat config: recommended JS + TypeScript rules; formatting is Prettier's job.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
	{ ignores: ['dist/', 'node_modules/', 'data/', 'research/'] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		// server, tests, scripts: Node
		files: ['src/**/*.ts', 'tests/**/*.ts', 'scripts/**/*.ts', '*.mjs'],
		languageOptions: { globals: globals.node },
	},
	{
		// the client: plain ES modules in the browser
		files: ['public/**/*.mjs', 'public/**/*.js'],
		languageOptions: { globals: globals.browser, sourceType: 'module' },
	},
	{
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'no-console': 'off',
		},
	},
);

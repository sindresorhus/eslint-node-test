import globals from 'globals';
import xo from 'eslint-config-xo';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import eslintPlugin from 'eslint-plugin-eslint-plugin';
import internalRules from './scripts/internal-rules/index.js';

const disabledJsdocRules = Object.fromEntries(
	Object.keys(jsdocPlugin.rules).map(name => [`jsdoc/${name}`, 'off']),
);

// Adjust the `xo` flat config:
// - Drop the duplicate `json` plugin on the package.json block (also defined by `@eslint/json`).
// - This project uses `node:test`, not AVA, so strip AVA's plugin and rules that `xo` bundles.
const xoConfig = xo().map(configBlock => {
	const block = {...configBlock};

	if (block.plugins?.json && block.files?.includes('**/package.json')) {
		const {json, ...plugins} = block.plugins;
		block.plugins = plugins;
	}

	if (block.plugins?.ava) {
		const {ava, ...plugins} = block.plugins;
		block.plugins = plugins;
	}

	block.rules &&= Object.fromEntries(
		Object.entries(block.rules).filter(([ruleId]) => !ruleId.startsWith('ava/')),
	);

	return block;
});

const config = [
	...xoConfig,
	internalRules,
	{
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
	},
	{
		ignores: [
			'coverage',
			'.ai-temporary',
			'.cache-eslint-remote-tester',
			'eslint-remote-tester-results',
			'test/integration/{fixtures,fixtures-local}/**',
			// Snapshot fixtures are generated markdown and currently trigger
			// markdown processor `getLoc` crashes under this ESLint setup.
			'test/**/snapshots/**',
			'**/*.ts',
		],
	},
	{
		rules: disabledJsdocRules,
	},
	{
		files: [
			'**/*.js',
		],
		rules: {
			'no-sequences': [
				'error',
				{
					allowInParentheses: false,
				},
			],
			'require-unicode-regexp': 'off',
			'no-shadow': 'off',
			'no-unused-vars': 'off',
			'n/prefer-global/process': 'off',
			'unicorn/prefer-array-flat': ['error', {
				functions: [
					'flat',
					'flatten',
				],
			}],
			'func-names': 'off',
			'@stylistic/function-paren-newline': 'off',
			// These `regexp/*` rules flag our own rule-implementation regexes, which run on source
			// code at lint time rather than untrusted input, and rewriting them would hurt readability.
			'regexp/no-super-linear-backtracking': 'off',
			'regexp/prefer-named-capture-group': 'off',
			// Our long-standing `eslint-disable` directives predate this rule and are self-explanatory.
			'@eslint-community/eslint-comments/require-description': 'off',
		},
	},
	{
		files: [
			'rules/*.js',
		],
		plugins: {
			'eslint-plugin': eslintPlugin,
		},
		rules: {
			...eslintPlugin.configs.all.rules,
			'eslint-plugin/require-meta-docs-description': [
				'error',
				{
					pattern: '.+',
				},
			],
			'eslint-plugin/require-meta-docs-recommended': [
				'error',
				{
					allowNonBoolean: true,
				},
			],
			'eslint-plugin/require-meta-docs-url': 'off',
			'eslint-plugin/require-meta-has-suggestions': 'off',
			'eslint-plugin/require-meta-schema-description': 'error',
		},
	},
	{
		// This script also exports a couple of pure functions for direct unit testing.
		files: ['scripts/rename-rule.js'],
		rules: {
			'unicorn/no-exports-in-scripts': 'off',
		},
	},
	{
		// Must run once when this module loads, before any test uses the snapshot serializer.
		files: ['test/utils/test.js'],
		rules: {
			'unicorn/no-top-level-side-effects': 'off',
		},
	},
];

export default config;

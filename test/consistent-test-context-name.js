import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Conventional `t`
		withTest('test(\'t\', t => {});'),
		withTest('test(\'t\', async t => {});'),

		// No context parameter
		withTest('test(\'t\', () => {});'),

		// Subtest using `t`
		withTest('test(\'t\', async t => { await t.test(\'s\', t => {}); });'),

		// Destructuring is not checked, even with a default value
		withTest('test(\'t\', ({mock}) => {});'),
		withTest('test(\'t\', ({mock} = {}) => {});'),

		// A rest parameter is not a named context parameter
		withTest('test(\'t\', (...args) => {});'),

		// A defaulted context parameter with the conventional name
		withTest('test(\'t\', (t = undefined) => {});'),

		// Custom name via option
		{
			code: withTest('test(\'t\', context => {});'),
			options: [{name: 'context'}],
		},

		// Not a test file
		'test(\'t\', context => {});',

		// Hook callbacks also receive a context but are intentionally excluded
		'import {beforeEach} from \'node:test\';\nbeforeEach(ctx => {});',

		// A TypeScript `this` parameter is erased at compile time, so it is not the context
		{
			code: withTest('test(\'t\', (this: void, t) => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withTest('test(\'t\', (this: void) => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Non-`t` parameter
		withTest('test(\'t\', context => {});'),
		withTest('test(\'t\', async ctx => {});'),

		// A defaulted context parameter is still named
		withTest('test(\'t\', (context = undefined) => {});'),

		// `it` alias
		'import {it} from \'node:test\';\nit(\'t\', testContext => {});',

		// Subtest with a non-`t` parameter
		withTest('test(\'t\', async t => { await t.test(\'s\', subContext => {}); });'),

		// Custom required name not met
		{
			code: withTest('test(\'t\', t => {});'),
			options: [{name: 'context'}],
		},

		// The context is the parameter after an erased `this` one, not the `this` itself
		{
			code: withTest('test(\'t\', (this: void, ctx) => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

import {getTester} from './utils/test.js';

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

		// Destructuring is not checked
		withTest('test(\'t\', ({mock}) => {});'),

		// Custom name via option
		{
			code: withTest('test(\'t\', context => {});'),
			options: [{name: 'context'}],
		},

		// Not a test file
		'test(\'t\', context => {});',
	],
	invalid: [
		// Non-`t` parameter
		withTest('test(\'t\', context => {});'),
		withTest('test(\'t\', async ctx => {});'),

		// `it` alias
		'import {it} from \'node:test\';\nit(\'t\', testContext => {});',

		// Subtest with a non-`t` parameter
		withTest('test(\'t\', async t => { await t.test(\'s\', subContext => {}); });'),

		// Custom required name not met
		{
			code: withTest('test(\'t\', t => {});'),
			options: [{name: 'context'}],
		},
	],
});

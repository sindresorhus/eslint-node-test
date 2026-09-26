import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Default style is chained
		withTest('test.skip(\'t\', () => {});'),
		withTest('test.only(\'t\', () => {});'),
		withTest('test.todo(\'t\', () => {});'),

		// No modifiers at all
		withTest('test(\'t\', () => {});'),
		withTest('test(\'t\', {timeout: 1000}, () => {});'),

		// Options with no chained equivalent — a reason string or an explicit `false`
		withTest('test(\'t\', {skip: \'work in progress\'}, () => {});'),
		withTest('test(\'t\', {todo: \'later\'}, () => {});'),
		withTest('test(\'t\', {only: false}, () => {});'),

		// The object descriptor form reads the same options
		withTest('test({skip: \'work in progress\', name: \'t\', fn: () => {}});'),

		// A `node:test` export that is not a test call
		'import {mock} from \'node:test\';\nmock.module(\'module.js\');',
		'import test from \'node:test\';\ncustom(\'t\', {skip: true}, () => {});',

		// Options style honored when configured
		{
			code: withTest('test(\'t\', {skip: true}, () => {});'),
			options: [{style: 'options'}],
		},

		// Not a test file
		'test(\'t\', {skip: true}, () => {});',

		// Hooks have no chained modifier form (`before.skip()` is not valid node:test), so a `skip`
		// option on a hook is not flagged
		'import {before} from \'node:test\';\nbefore(() => {}, {skip: true});',
		{
			code: 'import {beforeEach} from \'node:test\';\nbeforeEach(() => {}, {only: true});',
			options: [{style: 'options'}],
		},
	],
	invalid: [
		// Default chained style — `modifier: true` options flagged
		withTest('test(\'t\', {skip: true}, () => {});'),
		withTest('test(\'t\', {only: true}, () => {});'),
		withTest('test(\'t\', {todo: true}, () => {});'),

		// Options style — chained modifiers flagged
		{
			code: withTest('test.skip(\'t\', () => {});'),
			options: [{style: 'options'}],
		},
		{
			code: withTest('test.only(\'t\', () => {});'),
			options: [{style: 'options'}],
		},
		{
			code: withTest('test.todo(\'t\', () => {});'),
			options: [{style: 'options'}],
		},

		// A suite is a test call too, and the options style flags its chained modifier
		{
			code: 'import {describe} from \'node:test\';\ndescribe.skip(\'s\', () => {});',
			options: [{style: 'options'}],
		},

		// Every modifier property is reported, not just the first
		withTest('test(\'t\', {skip: true, only: true}, () => {});'),

		// Suite modifier via options under chained style
		'import {describe} from \'node:test\';\ndescribe(\'s\', {only: true}, () => {});',
		// A modifier value wrapped in a TypeScript cast is still `modifier: true`.
		{
			code: withTest('test(\'t\', {todo: true as const}, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		// The object descriptor form reads the same options
		withTest('test({skip: true, name: \'t\', fn: () => {}});'),
	],
});

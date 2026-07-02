import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'test("x");',

		// Test with a real body
		withImport('test("x", () => { assert.ok(a); });'),

		// Expression-body arrow is not an empty block
		withImport('test("x", () => doSomething());'),

		// Already a `.todo`
		'import {test} from \'node:test\';\ntest.todo("x");',

		// Intentional stub via options object
		withImport('test("x", {skip: true});'),

		// Options object alongside an empty body is still intentional
		withImport('test("x", {skip: true}, () => {});'),
		withImport('test("x", {todo: true}, () => {});'),

		// No title — cannot make a meaningful `.todo`
		withImport('test(myTitle, () => {});'),

		// Suites and hooks are out of scope
		'import {describe} from \'node:test\';\ndescribe("s", () => {});',
	],
	invalid: [
		// Title only
		withImport('test("x");'),

		// Empty body
		withImport('test("x", () => {});'),

		// Empty function-expression body
		withImport('test("x", function () {});'),

		// Empty async body
		withImport('test("x", async () => {});'),

		// `it` alias
		'import {it} from \'node:test\';\nit("x", () => {});',

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test("x", () => {});',

		// Empty body with a comment — reported but not fixed (would drop the comment)
		withImport('test("x", () => {\n\t// TODO: write this\n});'),

		// TypeScript
		{
			code: withImport('test("x", (): void => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

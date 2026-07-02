import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, beforeEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'test("x", async (t, done) => { done(); });',

		// Promise style — single context parameter
		withImport('test("x", async t => {});'),

		// Callback style — not async
		withImport('test("x", (t, done) => { done(); });'),

		// Async with only the context parameter
		withImport('test("x", async t => { await f(); });'),

		// Second parameter has a default — node:test does not pass `done` (arity 1)
		withImport('test("x", async (t, done = () => {}) => {});'),

		// Rest parameter — arity 1
		withImport('test("x", async (t, ...rest) => {});'),

		// Suite callback receives a SuiteContext, not a done callback
		'import {describe, it} from \'node:test\';\ndescribe("s", async t => { it("x", () => {}); });',
	],
	invalid: [
		// Async test with a callback parameter
		withImport('test("x", async (t, done) => { done(); });'),

		// Function expression form
		withImport('test("x", async function (t, done) { done(); });'),

		// Hook with callback parameter and async
		withImport('beforeEach(async (t, done) => { done(); });'),

		// `it` alias
		'import {it} from \'node:test\';\nit("x", async (t, done) => { done(); });',

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test("x", async (t, done) => { done(); });',

		// Extra parameters beyond done
		withImport('test("x", async (t, done, extra) => { done(); });'),

		// TypeScript
		{
			code: withImport('test("x", async (t, done): Promise<void> => { done(); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, beforeEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'test("x", (t, done) => { done(); });',

		// Single context parameter
		withImport('test("x", t => {});'),
		withImport('test("x", async t => { await f(); });'),

		// No parameters
		withImport('test("x", () => {});'),

		// Second parameter has a default — node:test does not pass `done` (arity 1)
		withImport('test("x", (t, done = () => {}) => {});'),

		// Rest parameter — arity 1
		withImport('test("x", (t, ...rest) => {});'),

		// Suite callback receives a SuiteContext, not a done callback — even with a second parameter
		'import {describe, it} from \'node:test\';\ndescribe("s", (s) => { it("x", () => {}); });',
		'import {describe, it} from \'node:test\';\ndescribe("s", (s, done) => { it("x", () => {}); });',

		// `test.describe(…)` via the default import is a suite too, not a callback-style test
		'import test from \'node:test\';\ntest.describe("s", (s, done) => { test.it("x", () => {}); });',

		// Global assertion configuration is not a test registration.
		'import test from \'node:test\';\ntest.assert.register(\'custom\', (actual, expected) => {});',

		// Subtests are method calls, not matched (out of scope, like no-callback-and-promise)
		withImport('test("x", t => { t.test("sub", (t, done) => { done(); }); });'),
	],
	invalid: [
		// Callback-style test
		withImport('test("x", (t, done) => { done(); });'),

		// Default import
		'import test from \'node:test\';\ntest("x", (t, done) => { done(); });',

		// Chained modifier form
		withImport('test.only("x", (t, done) => { done(); });'),

		// Async test that also declares a callback (also caught by no-callback-and-promise)
		withImport('test("x", async (t, done) => { done(); });'),

		// Function expression form
		withImport('test("x", function (t, done) { done(); });'),

		// Each hook
		withImport('beforeEach((t, done) => { done(); });'),
		'import {before, after, afterEach} from \'node:test\';\nbefore((t, done) => { done(); });\nafter((t, done) => { done(); });\nafterEach((t, done) => { done(); });',

		// `it` alias and renamed parameter
		'import {it} from \'node:test\';\nit("x", (t, cb) => { cb(); });',

		// Renamed import
		'import {test as t} from \'node:test\';\nt("x", (ctx, done) => { done(); });',

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test("x", (t, done) => { done(); });',

		// Extra parameters beyond done
		withImport('test("x", (t, done, extra) => { done(); });'),

		// Destructured second parameter — still callback style; message falls back to `done`
		withImport('test("x", (t, {fail}) => { fail(); });'),

		// Destructured first parameter alongside `done` — arity is still 2
		withImport('test("x", ({signal}, done) => { done(); });'),

		// TypeScript
		{
			code: withImport('test("x", (t: TestContext, done: () => void) => { done(); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, beforeEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// A TypeScript `this` parameter is erased, so the emitted function has arity 1 and no `done`
		{
			code: withImport('test("x", async function (this: unknown, done) { done(); });'),
			languageOptions: {parser: parsers.typescript},
		},
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

		// A hook's callback is its first argument, so trailing options never hide a 1-arity function
		withImport('beforeEach(async t => {}, {timeout: 1000});'),

		// A hook whose first argument is not a function never runs, so a `done` parameter or an async
		// function in a later slot is dead code, and the runner never reads `options.fn` for a hook
		withImport('beforeEach({}, async (t, done) => { done(); });'),
		withImport('beforeEach({fn: async (t, done) => { done(); }});'),
		withImport('test.beforeEach({}, async (t, done) => { done(); });'),
		'import test from \'node:test\';\ntest(\'x\', t => { t.beforeEach({}, async (t, done) => { done(); }); });',
		'import test from \'node:test\';\ntest(\'x\', t => { t.beforeEach({fn: async (t, done) => { done(); }}); });',

		// A callback-style body named out of line is not async
		withImport('const body = (t, done) => { done(); };\ntest("x", body);'),
	],
	invalid: [
		// Async test with a callback parameter
		withImport('test("x", async (t, done) => { done(); });'),

		// Function expression form
		withImport('test("x", async function (t, done) { done(); });'),

		// Hook with callback parameter and async
		withImport('beforeEach(async (t, done) => { done(); });'),

		// A hook's trailing options must not hide its callback
		withImport('beforeEach(async (t, done) => { done(); }, {timeout: 1000});'),
		'import {before} from \'node:test\';\nbefore(async (t, done) => { done(); }, {timeout: 1});',
		'import {after} from \'node:test\';\nafter(async (t, done) => { done(); }, {timeout: 1});',
		'import {afterEach} from \'node:test\';\nafterEach(async (t, done) => { done(); }, {timeout: 1});',
		'import test from \'node:test\';\ntest.beforeEach(async (t, done) => { done(); }, {timeout: 1});',

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
		{
			// TypeScript emits an optional parameter as a plain one, so the arity is still 2 and
			// `node:test` does pass `done` — unlike a JavaScript default parameter
			code: withImport('test("x", async (t, done?: () => void) => { done(); });'),
			languageOptions: {parser: parsers.typescript},
		},
		// An async subtest / context hook callback with a `done` parameter fails the same way
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'a\', async (sub, done) => { done(); }); });',
		'import {test} from \'node:test\';\ntest(\'p\', t => { t.beforeEach(async (sub, done) => {}); });',
		'import {test, getTestContext} from \'node:test\';\ntest(\'p\', async () => { await getTestContext().test(\'a\', async (sub, done) => {}); });',

		// A hook declared through `getTestContext()` is the same hook
		'import {test, getTestContext} from \'node:test\';\ntest(\'p\', t => { getTestContext().beforeEach(async (sub, done) => {}); });',

		// A TypeScript `this` parameter is erased, so the callback is the parameter after the context
		{
			code: withImport('test("x", async function (this: any, t, done) { done(); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// A body named out of line is the callback the runner calls, and a shared one is reported once
		withImport('const body = async (t, done) => { done(); };\ntest("x", body);'),
		withImport('async function body(t, done) { done(); }\ntest("x", body);'),
		withImport('const body = async (t, done) => { done(); };\ntest("a", body);\ntest("b", body);'),
		withImport('const hook = async (t, done) => { done(); };\nbeforeEach(hook);'),
		'import test from \'node:test\';\ntest(\'p\', t => { const hook = async (sub, done) => {}; t.beforeEach(hook); });',
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, beforeEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// A TypeScript `this` parameter is erased, so the emitted function has arity 1 and no `done`
		{
			code: withImport('test("x", async function (this: unknown, done) {});'),
			languageOptions: {parser: parsers.typescript},
		},
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

		// A hook's callback is its first argument, so trailing options never hide a 1-arity function
		withImport('beforeEach(t => {}, {timeout: 1000});'),

		// A hook whose first argument is not a function never runs, so a `done` parameter in a later slot is dead code, and the runner never reads `options.fn` for a hook either
		withImport('beforeEach({}, (t, done) => { done(); });'),
		withImport('beforeEach({fn(t, done) { done(); }});'),
		withImport('test.beforeEach({}, (t, done) => { done(); });'),
		withImport('test.beforeEach({fn(t, done) { done(); }});'),
		'import test from \'node:test\';\ntest(\'x\', t => { t.beforeEach({}, (t, done) => { done(); }); });',
		'import test from \'node:test\';\ntest(\'x\', t => { t.beforeEach({fn(t, done) { done(); }}); });',
	],
	invalid: [
		// Callback-style test
		withImport('test("x", (t, done) => { done(); });'),

		// `node:test` reads `fn` from the options object wherever it sits, so a 2-argument call runs the callback too
		'import test from \'node:test\';\ntest(\'a\', {fn(t, done) { done(); }});',
		'import test from \'node:test\';\ntest(\'a\', {name: \'a\', fn(t, done) { done(); }});',

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

		// A hook's trailing options must not hide its `done` parameter
		withImport('beforeEach((t, done) => { done(); }, {timeout: 1000});'),
		'import {before} from \'node:test\';\nbefore((t, done) => { done(); }, {timeout: 1});',
		'import {after} from \'node:test\';\nafter((t, done) => { done(); }, {timeout: 1});',
		'import {afterEach} from \'node:test\';\nafterEach((t, done) => { done(); }, {timeout: 1});',
		'import test from \'node:test\';\ntest.beforeEach((t, done) => { done(); }, {timeout: 1});',

		// A hook whose callback is last has no options to confuse it
		'import {beforeEach} from \'node:test\';\nbeforeEach((t, done) => { done(); }, {timeout: 1, retry: 2});',

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
		{
			// TypeScript emits an optional parameter as a plain one, so the arity is still 2 and `node:test` does pass `done`, unlike a JavaScript default parameter
			code: withImport('test("x", (t, done?: () => void) => { done(); });'),
			languageOptions: {parser: parsers.typescript},
		},
		// A subtest callback and a context hook receive `done` based on arity too
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'a\', (sub, done) => { done(); }); });',
		'import {test} from \'node:test\';\ntest(\'p\', t => { t.beforeEach((sub, done) => {}); });',
		'import {test, getTestContext} from \'node:test\';\ntest(\'p\', async () => { await getTestContext().test(\'a\', (sub, done) => { done(); }); });',

		// A hook declared through `getTestContext()` is the same hook
		'import {test, getTestContext} from \'node:test\';\ntest(\'p\', t => { getTestContext().beforeEach((sub, done) => {}); });',
		{
			code: '// A TypeScript `this` parameter is erased, so `done` is the second emitted parameter\nimport {test} from \'node:test\';\ntest(\'a\', function (this: void, t, done) {});',
			languageOptions: {parser: parsers.typescript},
		},

		// A body named out of line is the callback the runner calls, and a shared one is reported once
		withImport('const body = (t, done) => { done(); };\ntest("x", body);'),
		withImport('async function body(t, done) { done(); }\ntest("x", body);'),
		withImport('const body = (t, done) => { done(); };\ntest("a", body);\ntest("b", body);'),
		withImport('const hook = (t, done) => { done(); };\nbeforeEach(hook);'),
		'import {test} from \'node:test\';\ntest(\'p\', t => { const hook = (sub, done) => {}; t.beforeEach(hook); });',
	],
});

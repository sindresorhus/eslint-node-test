import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test from 'node:test';\nimport assert from 'node:assert';\n${code}`;
const withBeforeImport = code => `import {before} from 'node:test';\nimport assert from 'node:assert';\n${code}`;
const withNamespaceImport = code => `import * as nodeTest from 'node:test';\nimport assert from 'node:assert';\n${code}`;
const inTest = code => withImport(`test('loads', () => {\n\t${code}\n});`);
const inAsyncTest = code => withImport(`test('loads', async () => {\n\t${code}\n});`);
const inParentTest = code => withImport(`test('parent', t => {\n\t${code}\n});`);

test.snapshot({
	valid: [
		// An unrelated local that happens to be named `assert` is not the context's assert
		'import test from "node:test";\ntest("a", async () => {\n\tconst assert = {strictEqual() {}};\n\tload().then(v => { assert.strictEqual(v, 42); });\n});',
		'import test from "node:test";\ntest("a", async ({assert}) => {\n\tawait load().then(v => { assert.strictEqual(v, 42); });\n});',

		// `t.plan(n, {wait: true})` makes the runner block until the plan is fulfilled, so the
		// assertion is awaited even though the callback is floating. The runner reads the plan when
		// it is set, so it counts wherever it stands in the body.
		'import test from "node:test";\nimport assert from "node:assert";\n'
		+ 'test("a", async t => {\n\tt.plan(1, {wait: true});\n\tload().then(value => {\n\t\tassert.strictEqual(value, 42);\n\t});\n});',
		'import test from "node:test";\n'
		+ 'test("a", async t => {\n\tawait setup();\n\tt.plan(1, {wait: true});\n\tload().then(value => {\n\t\tt.assert.strictEqual(value, 42);\n\t});\n});',
		'import test from "node:test";\n'
		+ 'test("a", async t => {\n\tt.diagnostic("loading");\n\tt.plan(1, {wait: true});\n\tload().then(value => {\n\t\tt.assert.strictEqual(value, 42);\n\t});\n});',

		// Not a test file.
		'import assert from \'node:assert\';\nload().then(value => { assert.strictEqual(value, 42); });',

		// Handled chains.
		inAsyncTest('await load().then(value => { assert.strictEqual(value, 42); });'),
		inTest('return load().then(value => { assert.strictEqual(value, 42); });'),
		// A floating combinator leaves the chains inside its array just as late as a floating chain
		inAsyncTest('await Promise.all([load().then(value => { assert.strictEqual(value, 42); })]);'),
		inAsyncTest('return Promise.all([load().then(value => { assert.strictEqual(value, 42); })]);'),
		inTest('const promise = load().then(value => { assert.strictEqual(value, 42); });'),
		withImport('test(\'loads\', () => load().then(value => { assert.strictEqual(value, 42); }));'),

		// Promise callbacks without assertions.
		inTest('load().then(value => { handle(value); });'),
		inTest('load().catch(error => { handle(error); });'),

		// External callbacks are intentionally skipped.
		withImport('const assertionCallback = value => { assert.strictEqual(value, 42); };\ntest(\'loads\', () => {\n\tload().then(assertionCallback);\n});'),

		// Assertions inside nested helper functions are not part of the Promise callback body.
		inTest('load().then(value => { function check() { assert.strictEqual(value, 42); } check(); });'),
		inTest('load().then(value => { const check = () => { assert.strictEqual(value, 42); }; check(); });'),

		// Computed Promise method is unsupported.
		inTest('load()[method](value => { assert.strictEqual(value, 42); });'),

		// Suites are not awaited test bodies.
		'import {describe} from \'node:test\';\nimport assert from \'node:assert\';\ndescribe(\'loads\', () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',
		'import {suite} from \'node:test\';\nimport assert from \'node:assert\';\nsuite(\'loads\', () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',
		'import {test} from \'node:test\';\nimport assert from \'node:assert\';\ntest.describe(\'loads\', () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',
		'import {test} from \'node:test\';\nimport assert from \'node:assert\';\ntest.suite(\'loads\', () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',
		'import test, * as nodeTest from \'node:test\';\nimport assert from \'node:assert\';\ntest.describe(\'loads\', () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',

		// Nested regular functions inside tests are ignored.
		inTest('function helper() { load().then(value => { assert.strictEqual(value, 42); }); } helper();'),

		// `*.assert` only counts for tracked test context names.
		'import test from \'node:test\';\ntest(\'loads\', () => {\n\tload().then(value => { helper.assert.strictEqual(value, 42); });\n});',

		// Shadowed assert bindings are not the imported assertion API.
		withImport('test(\'loads\', () => {\n\tload().then(assert => { assert.strictEqual(value, 42); });\n});'),
		'import test from \'node:test\';\nimport {strictEqual} from \'node:assert\';\ntest(\'loads\', () => {\n\tload().then(strictEqual => { strictEqual(value, 42); });\n});',
		withImport('test(\'loads\', () => {\n\tload().then(() => { const assert = helper; assert.strictEqual(value, 42); });\n});'),
		'import test from \'node:test\';\ntest(\'loads\', async t => {\n\tload().then(t => { t.assert.strictEqual(value, 42); });\n});',

		// Shadowed subtest context names are not node:test contexts.
		inParentTest('function helper(t) {\n\t\tt.test(\'not node:test\', () => {\n\t\t\tload().then(value => { assert.strictEqual(value, 42); });\n\t\t});\n\t}\n\n\thelper(fakeTest);'),

		// Shadowed node:test bindings are not test boundaries.
		withImport('function wrapper(test) {\n\ttest(\'not node:test\', () => {\n\t\tload().then(value => { assert.strictEqual(value, 42); });\n\t});\n}\n\nwrapper(fakeTest);'),
		withBeforeImport('function wrapper(before) {\n\tbefore(() => {\n\t\tload().then(value => { assert.strictEqual(value, 42); });\n\t});\n}\n\nwrapper(fakeBefore);'),
		withNamespaceImport('function wrapper(nodeTest) {\n\tnodeTest.test(\'not node:test\', () => {\n\t\tload().then(value => { assert.strictEqual(value, 42); });\n\t});\n}\n\nwrapper(fakeTest);'),

		// A wait plan through `getTestContext()` is the same wait plan
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', async t => {\n\tgetTestContext().plan(1, {wait: true});\n\tPromise.resolve().then(() => { t.assert.ok(true); });\n});',
		'import {test, getTestContext} from \'node:test\';\n'
		+ 'test(\'a\', async () => {\n\tgetTestContext().plan(1, {wait: true});\n'
		+ '\tPromise.resolve().then(() => { getTestContext().assert.ok(true); });\n});',

		// The chain callback runs synchronously inside its own `try`, so a `catch` around the assertion
		// handles the failure
		inAsyncTest('load().then(value => { try { assert.strictEqual(value, 42); } catch (error) { report(error); } });'),

		// A promise assertion that is awaited inside a handled `try` block is caught by the `catch`
		inAsyncTest('try { await assert.rejects(load()); } catch (error) { report(error); }'),

		// A generator body does not run until it is iterated, so neither the test body nor the chain
		// callback ever reaches the assertion
		'import test from \'node:test\';\nimport assert from \'node:assert\';\n'
		+ 'test(\'loads\', async function* () {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',
		inAsyncTest('load().then(function* () { assert.strictEqual(value, 42); });'),

		// A class field initializer is not one of the statements of the test body: an instance field runs on
		// instantiation, and a static field's value is kept by the field rather than discarded
		inAsyncTest('class Fixture { field = load().then(value => { assert.strictEqual(value, 42); }); }\nnew Fixture();'),
		inAsyncTest('class Fixture { static field = load().then(value => { assert.strictEqual(value, 42); }); }'),
		inAsyncTest('class Fixture { static promise = load().then(value => { assert.ok(value); }); }\n\tawait Fixture.promise;'),

		// A declaration or an assignment in a `for` slot keeps the Promise, so it may be awaited later
		inAsyncTest('for (let promise = load().then(value => assert.ok(value)), i = 0; i < 1; i++) {\n\t\tawait promise;\n\t}'),
		inAsyncTest('for (const value = load().then(v => { assert.strictEqual(v, 42); });;) {}'),
		inAsyncTest('for (holder.value = load().then(v => { assert.strictEqual(v, 42); });;) {}'),
		inAsyncTest('for (; i < 1; i = load().then(v => { assert.strictEqual(v, 42); })) {}'),

		// Only the four combinators spelled on the global `Promise`, with a written-out array, are read
		inAsyncTest('Promise[\'all\']([load().then(value => { assert.strictEqual(value, 42); })]);'),
		inAsyncTest('Promise.resolve([load().then(value => { assert.strictEqual(value, 42); })]);'),
		inAsyncTest('Promise.race(load().then(value => { assert.strictEqual(value, 42); }));'),
		inAsyncTest('Promise.all([...load().then(value => { assert.strictEqual(value, 42); })]);'),
		// Known limitation: a combinator with a chain on it is not looked into
		inAsyncTest('Promise.all([load().then(value => { assert.strictEqual(value, 42); })]).catch(() => {});'),

		// A throw or a subtest in a floating callback is what `no-late-test-activity` reports, not an assertion
		inAsyncTest('load().then(() => { throw new Error(\'boom\'); });'),
		inParentTest('load().then(() => { t.test(\'child\', () => {}); });'),

		// A callback-style test body is not awaited: node:test hands a `done` function to a callback
		// that declares two parameters
		'import test from \'node:test\';\nimport assert from \'node:assert\';\n'
		+ 'test(\'loads\', (t, done) => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',
	],
	invalid: [
		// A `void` discards the chain wherever it stands, a static field initializer included
		inAsyncTest('class Fixture { static field = void load().then(value => { assert.strictEqual(value, 42); }); }'),

		// A bare expression in a `for` initializer or update slot is discarded, so a chain left in one
		// is left unhandled
		inAsyncTest('for (load().then(value => { assert.strictEqual(value, 42); });;) {}'),
		inAsyncTest('for (; i < 1; load().then(v => { assert.strictEqual(v, 42); })) {}'),

		// A destructured `assert` is the context's assert, so an assertion through it is owned by
		// the same rule as `t.assert.*` and the imported module
		'import test from "node:test";\ntest("a", async ({assert}) => {\n\tload().then(v => { assert.strictEqual(v, 42); });\n});',
		'import test from "node:test";\ntest("a", async ({assert: {strictEqual}}) => {\n\tload().then(v => { strictEqual(v, 42); });\n});',

		// A floating combinator leaves the chains inside its array just as late as a floating chain,
		// so an assertion in one of them is just as unawaited
		inAsyncTest('Promise.all([load().then(value => { assert.strictEqual(value, 42); })]);'),
		inAsyncTest('Promise.allSettled([load().then(value => { assert.strictEqual(value, 42); })]);'),
		inAsyncTest('Promise.race([load().then(value => { assert.strictEqual(value, 42); })]);'),
		inAsyncTest('Promise.any([load().then(value => { assert.strictEqual(value, 42); })]);'),
		inAsyncTest('Promise.all([[load().then(value => { assert.strictEqual(value, 42); })]]);'),
		inAsyncTest('Promise.all([load().then(value => { assert.strictEqual(value, 42); }), other.catch(error => { assert.ok(error); })]);'),

		// Imported assert namespace.
		inAsyncTest('load().then(value => { assert.strictEqual(value, 42); });'),
		withNamespaceImport('nodeTest.test(\'loads\', async () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});'),
		inAsyncTest('load().then(value => assert.strictEqual(value, 42));'),
		inAsyncTest('load().then(value => { assert(value); });'),

		// `it` alias.
		'import {it} from \'node:test\';\nimport assert from \'node:assert\';\nit(\'loads\', async () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',

		// Assert strict module.
		'import test from \'node:test\';\nimport assert from \'node:assert/strict\';\ntest(\'loads\', async () => {\n\tload().then(value => { assert.equal(value, 42); });\n});',

		// Named and renamed imports.
		'import test from \'node:test\';\nimport {strictEqual} from \'node:assert\';\ntest(\'loads\', async () => {\n\tload().then(value => { strictEqual(value, 42); });\n});',
		'import test from \'node:test\';\nimport {strictEqual as equal} from \'node:assert\';\ntest(\'loads\', async () => {\n\tload().then(value => { equal(value, 42); });\n});',

		// Test context assertion.
		'import test from \'node:test\';\ntest(\'loads\', async t => {\n\tload().then(value => { t.assert.strictEqual(value, 42); });\n});',

		// Rejection callback.
		inAsyncTest('load().then(undefined, error => { assert.ifError(error); });'),

		// Catch/finally.
		inAsyncTest('load().catch(error => { assert.ifError(error); });'),
		inAsyncTest('load().finally(() => { assert.ok(cleanedUp); });'),

		// Chained callbacks.
		inAsyncTest('load().then(value => { assert.strictEqual(value, 42); }).catch(error => { assert.ifError(error); });'),
		inAsyncTest('load().then(value => { assert.ok(value); assert.strictEqual(value, 42); });'),

		// Optional chaining.
		inAsyncTest('promise?.then(value => { assert.strictEqual(value, 42); });'),
		inAsyncTest('load?.().then(value => { assert.strictEqual(value, 42); });'),

		// Void chains are reported but not fixed.
		inAsyncTest('void load().then(value => { assert.strictEqual(value, 42); });'),

		// Non-async callback is reported but not fixed.
		inTest('load().then(value => { assert.strictEqual(value, 42); });'),

		// Hooks.
		'import {before} from \'node:test\';\nimport assert from \'node:assert\';\nbefore(async () => {\n\tsetup().then(value => { assert.strictEqual(value, 42); });\n});',
		'import {beforeEach} from \'node:test\';\nbeforeEach(async t => {\n\tsetup().then(value => { t.assert.strictEqual(value, 42); });\n});',
		'import {afterEach} from \'node:test\';\nimport assert from \'node:assert\';\nafterEach(async () => {\n\tteardown().then(value => { assert.strictEqual(value, 42); });\n});',

		// Subtests.
		withImport('test(\'parent\', async t => {\n\tawait t.test(\'child\', async () => {\n\t\tload().then(value => { assert.strictEqual(value, 42); });\n\t});\n});'),

		// Static blocks cannot be fixed by inserting `await`.
		inAsyncTest('class Fixture {\n\t\tstatic {\n\t\t\tload().then(value => { assert.strictEqual(value, 42); });\n\t\t}\n\t}'),

		// TypeScript wrappers around callbacks.
		{
			code: inAsyncTest('load().then((value => { assert.strictEqual(value, 42); }) as (value: number) => void);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: inAsyncTest('load().then((value => { assert.strictEqual(value, 42); }) satisfies (value: number) => void);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: inAsyncTest('load().then((value => { assert.strictEqual(value, 42); })!);'),
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript wrapper around the whole floating chain. Reported without a fix: the parentheses
		// do not help, because `as` binds looser than `await` inside them too, so
		// `(await chain as Promise<void>)` casts the awaited value and does not type check.
		{
			code: inAsyncTest('(load().then(value => { assert.strictEqual(value, 42); }) as Promise<void>);'),
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript wrapper around the test callee itself still marks the test boundary.
		{
			code: withImport('(test as typeof test)(\'loads\', async () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});'),
			languageOptions: {parser: parsers.typescript},
		},

		// `getTestContext()` returns the same test context, so its `assert` is a real assertion
		'import {test, getTestContext} from \'node:test\';\ntest(\'loads\', async () => {\n\tload().then(value => { getTestContext().assert.strictEqual(value, 42); });\n});',
		'import {test, getTestContext} from \'node:test\';\ntest(\'loads\', async () => {\n\tload().then(() => { getTestContext().assert.rejects(load()); });\n});',

		// A getTestContext() subtest is its own boundary
		'import {test, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\n'
		+ 'test(\'o\', async () => {\n\tawait getTestContext().test(\'s\', () => { load().then(v => { assert.equal(v, 1); }); });\n});',
		'// A `getTestContext()` hook is the same hook, so its callback is the same boundary\nimport {test, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\n'
		+ 'test(\'a\', t => {\n\tgetTestContext().beforeEach(() => {\n\t\tfoo().then(() => { assert.ok(x); });\n\t});\n});',

		// `wait: false` is not a wait plan, so the runner does not block for the assertion
		'import test from \'node:test\';\nimport assert from \'node:assert\';\n'
		+ 'test(\'a\', async t => {\n\tt.plan(1, {wait: false});\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',

		// A chain whose value a surrounding expression hands on to the discarded statement can take the
		// `await`; the discarded side of `&&` has nowhere to put one, so it is reported without a fix
		inAsyncTest('flag || load().then(value => { assert.strictEqual(value, 42); });'),
		inAsyncTest('load().then(value => { assert.strictEqual(value, 42); }) && flag;'),

		// A `catch` around the chain cannot handle a failure raised after the test body returned
		inAsyncTest('try { load().then(value => { assert.strictEqual(value, 42); }); } catch (error) { report(error); }'),

		// A `finally` is not a handler, so it does not catch the assertion failure
		inAsyncTest('load().then(value => { try { assert.strictEqual(value, 42); } finally { cleanup(); } });'),

		// A promise assertion is not handled by a surrounding `try` unless it is awaited there
		inAsyncTest('load().then(() => { try { assert.rejects(load()); } catch (error) { report(error); } });'),
		inAsyncTest('load().then(async () => { await assert.rejects(load()); });'),

		// `doesNotReject` is a promise assertion too
		inAsyncTest('load().then(() => { assert.doesNotReject(load()); });'),

		// Assert namespace.
		'import test from \'node:test\';\nimport * as nodeAssert from \'node:assert\';\n'
		+ 'test(\'loads\', async () => {\n\tload().then(value => { nodeAssert.strictEqual(value, 42); });\n});',

		// A hook written as a member of the test binding.
		'import test from \'node:test\';\nimport assert from \'node:assert\';\n'
		+ 'test.afterEach(async () => {\n\tteardown().then(value => { assert.strictEqual(value, 42); });\n});',

		// A hook declared on a tracked context is a boundary, and its callback is not async, so there is
		// no fix
		'import test from \'node:test\';\nimport assert from \'node:assert\';\n'
		+ 'test(\'parent\', t => {\n\tt.beforeEach(() => {\n\t\tsetup().then(value => { assert.strictEqual(value, 42); });\n\t});\n});',

		// A modifier is still a test boundary.
		'import test from \'node:test\';\nimport assert from \'node:assert\';\n'
		+ 'test.only(\'loads\', async () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',

		// Object descriptor argument slot.
		'import test from \'node:test\';\nimport assert from \'node:assert\';\n'
		+ 'test({name: \'loads\', fn: async () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n}});',

		// A cast on the context receiver does not hide the context's assert.
		{
			code: withImport('test(\'loads\', async t => {\n\tload().then(value => { (t as any).assert.strictEqual(value, 42); });\n});'),
			languageOptions: {parser: parsers.typescript},
		},

		// `!` binds tighter than `await`, so the fix applies; `satisfies` binds looser, so it does not.
		{
			code: inAsyncTest('(load().then(value => { assert.strictEqual(value, 42); }))!;'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: inAsyncTest('load().then(value => { assert.strictEqual(value, 42); }) satisfies unknown;'),
			languageOptions: {parser: parsers.typescript},
		},

		// The fix leaves the parentheses and the comments of the chain alone.
		inAsyncTest('(load().then(value => { assert.strictEqual(value, 42); }));'),
		inAsyncTest('load() /* keep */.then(value => { assert.strictEqual(value, 42); });'),

		// A closure over the destructured `assert` of an outer test still resolves inside a nested subtest.
		'import {test, getTestContext} from \'node:test\';\n'
		+ 'test(\'parent\', async ({assert}) => {\n'
		+ '\tawait getTestContext().test(\'child\', async () => {\n'
		+ '\t\tload().then(value => { assert.ok(value); });\n\t});\n});',

		// A TypeScript `this` parameter is erased at compile time, so `t` is the context
		{
			code: withImport('test(\'a\', async (this: void, t) => { p().then(() => { t.assert.ok(1); }); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// A body named out of line runs as the test's callback, the same as an inline one
		withImport('const body = async t => {\n\tload().then(value => { t.assert.ok(value); });\n};\ntest(\'loads\', body);'),
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// Not a test file — bail out early
		'test("title", () => { doSomething(); });',

		// A skipped callback never runs, so it cannot pass vacuously. A `todo` callback does run, so it
		// is still checked.
		'import test from "node:test";\ntest.skip("t", () => { doSomething(); });',
		'import test from "node:test";\ntest("t", {skip: true}, () => { doSomething(); });',
		'import test from "node:test";\ntest("t", {skip: "flaky"}, () => { doSomething(); });',
		'import test from "node:test";\ntest("t", {skip: 0}, () => { doSomething(); });',
		'import {it, skip} from "node:test";\nit.skip("t", () => { doSomething(); });\nskip("u", () => { doSomething(); });',

		// The assert.* form
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { assert.strictEqual(1, 1); });',

		// Bare assert(value)
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { assert(value); });',

		// Named import form
		'import test from "node:test";\nimport {strictEqual} from "node:assert";\ntest("t1", () => { strictEqual(1, 1); });',

		// The t.assert.* form
		'import test from "node:test";\ntest("t1", t => { t.assert.strictEqual(1, 1); });',

		// Destructured TestContext.assert form
		'import test from "node:test";\ntest("t1", ({assert}) => assert.ok(1));',
		'import test from "node:test";\ntest("t1", ({assert}) => { assert.strictEqual(1, 1); });',
		'import test from "node:test";\ntest("t1", ({assert: testAssert}) => { testAssert.strictEqual(1, 1); });',
		// Destructuring the methods straight off `assert` still calls a real assertion
		'import test from "node:test";\ntest("t1", ({assert: {ok}}) => { ok(1); });',
		'import test from "node:test";\ntest("t1", ({assert: {strictEqual}}) => { strictEqual(1, 1); });',
		// A defaulted `assert` binding is still a real assertion
		'import test from "node:test";\ntest("t1", ({assert = fallback}) => { assert.ok(1); });',
		// A renamed destructured method is the method it was destructured from
		'import test from "node:test";\ntest("t1", ({assert: {ok: check}}) => { check(1); });',
		'import test from "node:test";\ntest("t1", ({assert: {strictEqual: same}}) => { same(a, b); });',

		// Nested tests each use their own destructured assertion binding
		'import test from "node:test";\ntest("outer", ({assert}) => { assert.ok(1); test("inner", ({assert}) => { assert.ok(2); }); });',

		// TypeScript wrapper around a destructured assertion binding
		{
			code: 'import test from "node:test";\ntest("t1", ({assert}: TestContext) => { (assert as TestContext["assert"]).ok(1); });',
			languageOptions: {parser: parsers.typescript},
		},

		// The it() alias
		'import {it} from "node:test";\nimport assert from "node:assert";\nit("t1", () => { assert.ok(true); });',

		// The node:assert/strict module
		'import test from "node:test";\nimport assert from "node:assert/strict";\ntest("t1", () => { assert.strictEqual(1, 1); });',

		// The node:assert/strict named import
		'import test from "node:test";\nimport {deepStrictEqual} from "node:assert/strict";\ntest("t1", () => { deepStrictEqual(a, b); });',

		// Describe/suite do not require assertions
		'import {describe} from "node:test";\ndescribe("group", () => { const x = 1; });',

		// Hooks do not require assertions
		'import {before, afterEach} from "node:test";\nbefore(() => { setup(); });\nafterEach(() => { teardown(); });',

		// Assertion nested inside a helper call inside the test counts
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { (() => { assert.ok(true); })(); });',

		// Renamed import
		'import {test as myTest} from "node:test";\nimport assert from "node:assert";\nmyTest("t1", () => { assert.ok(1); });',

		// Namespace import — assertion via assert.*
		'import * as nodeTest from "node:test";\nimport assert from "node:assert";\nnodeTest.test("t1", () => { assert.ok(1); });',

		// Test with no inline callback (external implementation) — skip reporting
		'import test from "node:test";\ntest("t1", implementation);',

		// Test with no args at all
		'import test from "node:test";\ntest("t1");',

		// Async test with assertion
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", async () => { assert.ok(await fetchValue()); });',

		// `node:test` spreads the options over the positional callback, so `options.fn` is the body
		// that runs and the trailing function is dead code
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", {fn() { assert.ok(true); }}, () => {});',
		'import test from "node:test";\ntest("t1", {fn(t) { t.assert.ok(1); }}, () => {});',
		// A hook takes its callback first and the runner never reads `options.fn` for it
		'import {beforeEach} from "node:test";\nimport assert from "node:assert";\nbeforeEach(() => { assert.ok(true); }, {fn() {}});',

		// Outer test with its own assertion and a subtest
		'import test from "node:test";\nimport assert from "node:assert";\ntest("outer", t => { assert.ok(1); t.test("inner", () => {}); });',
		// T.test() subtests are not tracked as import-based test boundaries, so assertions inside them are seen by the outer scope (intentional false negative — keep simple)
		'import test from "node:test";\nimport assert from "node:assert";\ntest("outer", t => { t.test("inner", () => { assert.ok(1); }); });',
		// A bare `test` package is not Node's test runner.
		'import test from "test";\ntest("t1", () => { doSomething(); });',

		// `getTestContext().assert.ok(…)` is a real context assertion, exactly like `t.assert.ok(…)`
		'import test, {getTestContext} from \'node:test\';\ntest(\'a\', () => { getTestContext().assert.ok(1); });',

		// `test.getTestContext()` is the same context, however the test function is bound
		'import {test} from \'node:test\';\ntest(\'a\', () => { test.getTestContext().assert.equal(1, 1); });',
		'import {it} from \'node:test\';\nit(\'a\', () => { it.getTestContext().assert.equal(1, 1); });',
		'import {test as check} from \'node:test\';\ncheck(\'a\', () => { check.getTestContext().assert.equal(1, 1); });',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'a\', () => { nodeTest.test.getTestContext().assert.equal(1, 1); });',
	],
	invalid: [
		// `skip: false` and `only` still run, so the assertion is still required
		'import test from "node:test";\ntest("t", {skip: false}, () => { doSomething(); });',
		'import test from "node:test";\ntest.only("t", () => { doSomething(); });',
		'import test from "node:test";\ntest.todo("t", () => { doSomething(); });',
		// Only the assertion shapes the shared helper accepts count; a deeper chain is not one
		'import test from \'node:test\';\ntest("x", ({assert}) => { assert.a.b.c.d(); });',
		'import test from \'node:test\';\ntest("x", ({assert: {a: {b}}}) => { b(1); });',
		// A destructured method that is shadowed before use is not a real assertion
		'import test from "node:test";\ntest("t1", ({assert: {ok}}) => { { const ok = () => {}; } f(); });',
		// Destructuring a method without calling it is not an assertion
		'import test from "node:test";\ntest("t1", ({assert: {ok}}) => { f(); });',

		// `node:test` reads `fn` from the options object wherever it sits
		'import test from \'node:test\';\ntest(\'a\', {fn() {}});',

		// The object form is still a test, so it still needs an assertion
		'import test from \'node:test\';\ntest({name: \'x\', fn() {}});',

		// No assertion at all
		'import test from "node:test";\ntest("t1", () => { doSomething(); });',

		// `.assert.*` on a non-context object does not count as an assertion
		'import test from "node:test";\ntest("t1", () => { myFakeService.assert.ok(1); });',

		// Empty test body
		'import test from "node:test";\ntest("t1", () => {});',

		// It() with no assertion
		'import {it} from "node:test";\nit("t1", () => { doSomething(); });',

		// Renamed import, no assertion
		'import {test as myTest} from "node:test";\nmyTest("t1", () => { doSomething(); });',

		// Namespace import, no assertion
		'import * as nodeTest from "node:test";\nnodeTest.test("t1", () => { doSomething(); });',

		// TypeScript
		{
			code: 'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", (): void => { doSomething(); });',
			languageOptions: {parser: parsers.typescript},
		},

		// A local assert binding is not a destructured TestContext.assert
		'import test from "node:test";\ntest("t1", () => { const assert = customAssert; assert.ok(1); });',

		// An unrelated receiver is not a destructured TestContext.assert
		'import test from "node:test";\ntest("t1", () => { customAssert.ok(1); });',

		// A helper parameter shadowing the destructured assertion binding does not count
		'import test from "node:test";\ntest("t1", ({assert}) => { function helper(assert) { assert.ok(1); } helper(customAssert); });',

		// An assertion in a nested test does not count for the outer test
		'import test from "node:test";\ntest("outer", () => { test("inner", ({assert}) => { assert.ok(1); }); });',

		// An assertion in a test title does not count for that test
		'import test from "node:test";\nimport assert from "node:assert";\ntest(assert.ok(1), () => {});',

		// An assertion in a nested test title belongs to the outer callback
		'import test from "node:test";\nimport assert from "node:assert";\ntest("outer", () => { test(assert.ok(1), () => {}); });',
		'import test from "node:test";\ntest("outer", ({assert}) => { test(assert.ok(1), () => {}); });',

		// A nested test with an external implementation does not count as an assertion in its parent
		'import test from "node:test";\ntest("outer", () => { test("inner", implementation); });',

		// A captured destructured assertion belongs to the nested callback where it is called
		'import test from "node:test";\ntest("outer", ({assert}) => { test("inner", () => { assert.ok(1); }); });',

		// A captured context assertion belongs to the nested callback where it is called
		'import test from "node:test";\ntest("outer", t => { test("inner", () => { t.assert.ok(1); }); });',

		// The trailing function is dead code when the options slot has an `fn`, so an assertion in it
		// does not count
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", {fn() {}}, () => { assert.ok(true); });',
		'import test from "node:test";\ntest("t1", {fn() {}}, t => { t.assert.ok(1); });',

		// `TestContext#assert` is a plain object of assertion methods: it has no `strict` view and
		// is not callable, so these three throw a `TypeError` instead of asserting anything.
		'import test from "node:test";\ntest("t1", ({assert}) => { assert.strict.equal(1, 1); });',
		'import test from "node:test";\ntest("t1", ({assert: {strict: s}}) => { s.equal(1, 1); });',
		'import test from "node:test";\ntest("t1", ({assert}) => { assert(1); });',
		'import test from "node:test";\ntest("t1", (t) => { t.assert.strict(1); });',
		// An unrelated object with the same method is not a test context
		'import {test} from \'node:test\';\ntest(\'a\', () => { foo.getTestContext().assert.equal(1, 1); });',
	],
});

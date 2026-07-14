import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// Not a test file — bail out early
		'test("title", () => { doSomething(); });',

		// The assert.* form
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { assert.strictEqual(1, 1); });',

		// Bare assert(value)
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { assert(value); });',

		// Named import form
		'import test from "node:test";\nimport {strictEqual} from "node:assert";\ntest("t1", () => { strictEqual(1, 1); });',

		// The t.assert.* form
		'import test from "node:test";\ntest("t1", t => { t.assert.strictEqual(1, 1); });',

		// Destructured TestContext.assert form
		'import test from "node:test";\ntest("t1", ({assert}) => { assert.strictEqual(1, 1); });',
		'import test from "node:test";\ntest("t1", ({assert: testAssert}) => { testAssert.strictEqual(1, 1); });',

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

		// Outer test with its own assertion and a subtest
		'import test from "node:test";\nimport assert from "node:assert";\ntest("outer", t => { assert.ok(1); t.test("inner", () => {}); });',
		// T.test() subtests are not tracked as import-based test boundaries, so assertions inside them are seen by the outer scope (intentional false negative — keep simple)
		'import test from "node:test";\nimport assert from "node:assert";\ntest("outer", t => { t.test("inner", () => { assert.ok(1); }); });',
		// A bare `test` package is not Node's test runner.
		'import test from "test";\ntest("t1", () => { doSomething(); });',
	],
	invalid: [
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

		// A nested test with an external implementation does not count as an assertion in its parent
		'import test from "node:test";\ntest("outer", () => { test("inner", implementation); });',

		// A captured destructured assertion belongs to the nested callback where it is called
		'import test from "node:test";\ntest("outer", ({assert}) => { test("inner", () => { assert.ok(1); }); });',

		// A captured context assertion belongs to the nested callback where it is called
		'import test from "node:test";\ntest("outer", t => { test("inner", () => { t.assert.ok(1); }); });',
	],
});

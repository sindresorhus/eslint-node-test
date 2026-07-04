import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// Not a test file
		'test("title", () => { if (x) { assert.ok(1); } });',

		// Unconditional assertion — assert.X
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { assert.strictEqual(1, 1); });',

		// Unconditional assertion — bare assert(value)
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { assert(value); });',

		// Unconditional assertion — named import
		'import test from "node:test";\nimport {strictEqual} from "node:assert";\ntest("t1", () => { strictEqual(1, 1); });',

		// Unconditional assertion — t.assert.X
		'import test from "node:test";\ntest("t1", t => { t.assert.strictEqual(1, 1); });',

		// Assertion after an if block (not inside it)
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { if (x) { setup(); } assert.ok(1); });',

		// Assertion in the test expression of if (always runs)
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { if (assert.ok(value)) { setup(); } });',

		// Assertion in the test expression of ternary (always runs)
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { assert.ok(value) ? setup() : teardown(); });',

		// Assertion on left side of logical (always runs — left side is not short-circuited)
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { assert.ok(1) && setup(); });',

		// It() with unconditional assertion
		'import {it} from "node:test";\nimport assert from "node:assert";\nit("t1", () => { assert.ok(true); });',

		// Renamed import
		'import {test as myTest} from "node:test";\nimport assert from "node:assert";\nmyTest("t1", () => { assert.ok(1); });',

		// Namespace import
		'import * as nodeTest from "node:test";\nimport assert from "node:assert";\nnodeTest.test("t1", () => { assert.ok(1); });',

		// Conditional wrapping the entire test call (not inside the test body)
		'import test from "node:test";\nimport assert from "node:assert";\nif (x) { test("t1", () => { assert.ok(1); }); }',

		// Suite bodies only register tests; conditional assertions there are not this rule's concern
		'import {describe} from "node:test";\nimport assert from "node:assert";\ndescribe("group", () => { if (x) { assert.ok(1); } });',

		// Unconditional assertion inside a subtest whose call is wrapped in an outer conditional —
		// the assertion is scoped to the subtest, not the outer conditional
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", async t => { if (x) { await t.test("inner", () => { assert.ok(1); }); } });',

		// `.assert.*` on a non-context object inside a conditional — not a test context
		'import test from "node:test";\ntest("t1", () => { const db = makeDb(); if (x) { db.assert.ok(a); } });',
	],
	invalid: [
		// If without else
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { if (x) { assert.strictEqual(1, 1); } });',

		// If/else where only one branch asserts
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { if (x) { assert.ok(1); } else { setup(); } });',

		// Ternary — assertion in consequent only
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { x ? assert.ok(1) : null; });',

		// Ternary — assertion in alternate only
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { x ? null : assert.ok(1); });',

		// Logical && — right side is conditional
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { ready && assert.ok(value); });',

		// Logical || — right side is conditional
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { ready || assert.ok(value); });',

		// Logical ?? — right side is conditional
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { ready ?? assert.ok(value); });',

		// Switch case without default
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { switch (x) { case 1: assert.ok(1); break; } });',

		// While loop body
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { while (running) { assert.ok(1); } });',

		// For loop body
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { for (let i = 0; i < 3; i++) { assert.ok(i >= 0); } });',

		// For-of loop body
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { for (const item of items) { assert.ok(item); } });',

		// For-in loop body
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { for (const key in obj) { assert.ok(key); } });',

		// Do-while loop body
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { do { assert.ok(1); } while (x); });',

		// Bare assert(value) inside conditional
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { if (x) { assert(value); } });',

		// Named import inside conditional
		'import test from "node:test";\nimport {strictEqual} from "node:assert";\ntest("t1", () => { if (x) { strictEqual(1, 1); } });',

		// T.assert.X inside conditional
		'import test from "node:test";\ntest("t1", t => { if (x) { t.assert.strictEqual(1, 1); } });',

		// It() with conditional assertion
		'import {it} from "node:test";\nimport assert from "node:assert";\nit("t1", () => { if (x) { assert.ok(1); } });',

		// Renamed import with conditional assertion
		'import {test as myTest} from "node:test";\nimport assert from "node:assert";\nmyTest("t1", () => { if (x) { assert.ok(1); } });',

		// Namespace import with conditional assertion
		'import * as nodeTest from "node:test";\nimport assert from "node:assert";\nnodeTest.test("t1", () => { if (x) { assert.ok(1); } });',

		// Conditional assertion inside a hook is also flagged
		'import {beforeEach} from "node:test";\nimport assert from "node:assert";\nbeforeEach(() => { if (x) { assert.ok(1); } });',

		// Lexically conditional, even inside a nested helper function (the rule is purely syntactic)
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", () => { const check = () => { if (x) { assert.ok(1); } }; check(); });',

		// Conditional assertion inside a subtest body is still flagged (scoped to the subtest)
		'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", async t => { await t.test("inner", () => { if (x) { assert.ok(1); } }); });',

		// TypeScript
		{
			code: 'import test from "node:test";\nimport assert from "node:assert";\ntest("t1", (): void => { if (x) { assert.ok(1); } });',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

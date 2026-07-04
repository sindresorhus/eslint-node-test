import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {describe, it, test} from 'node:test';\nimport assert from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'describe("s", () => { assert.ok(x); });',

		// Assertion inside a test — correct
		withImport('describe("s", () => { it("a", () => { assert.ok(x); }); });'),

		// Assertion inside a hook — correct
		withImport('import {beforeEach} from \'node:test\';\ndescribe("s", () => { beforeEach(() => { assert.ok(x); }); });'),

		// Assertion inside a helper function defined in the body — not directly in the suite
		withImport('describe("s", () => { function check() { assert.ok(x); } it("a", () => check()); });'),

		// Assertion in a subtest
		withImport('test("a", async t => { await t.test("child", () => { assert.ok(x); }); });'),

		// Top-level assertion (not inside a describe)
		withImport('assert.ok(x);'),

		// Non-assertion calls in the body are not this rule's concern
		withImport('describe("s", () => { setup(); it("a", () => {}); });'),

		// `.assert.*` on a non-context object — not a test context
		withImport('describe("s", () => { const f = {assert: {ok() {}}}; f.assert.ok(x); });'),
	],
	invalid: [
		// Assertion directly in a describe body
		withImport('describe("s", () => { assert.ok(x); it("a", () => {}); });'),

		// Bare assert function
		withImport('describe("s", () => { assert(x); });'),

		// Conditionally in the describe body (still runs at collection)
		withImport('describe("s", () => { if (y) { assert.strictEqual(a, b); } });'),

		// Suite alias
		withImport('import {suite} from \'node:test\';\nsuite("s", () => { assert.deepStrictEqual(a, b); });'),

		// Nested describe body
		withImport('describe("outer", () => { describe("inner", () => { assert.ok(x); }); });'),

		// Named assert import
		'import {describe} from \'node:test\';\nimport {ok} from \'node:assert\';\ndescribe("s", () => { ok(x); });',

		// TypeScript
		{
			code: withImport('describe("s", () => { assert.ok(x as boolean); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'function f(t) { t.skip(); doStuff(); }',

		// Skip is the last statement — nothing runs after it
		withImport('test("x", t => { t.skip(); });'),
		withImport('test("x", t => { doStuff(); t.skip(); });'),

		// Followed by return
		withImport('test("x", t => { if (cond) { t.skip(); return; } assert.ok(x); });'),

		// Followed by throw
		withImport('test("x", t => { if (cond) { t.skip(); throw new Error(); } assert.ok(x); });'),

		// `skip` on something that is not a test context
		withImport('test("x", () => { other.skip(); doStuff(); });'),

		// A local variable shadowing the context name is not the test context
		withImport('test("x", t => { function helper() { const t = {skip() {}}; t.skip(); doStuff(); } });'),

		// The skip option object form is unaffected
		withImport('test("x", {skip: true}, t => { doStuff(); });'),

		// Best-effort limitation: code after a skip inside a `switch` case is not detected,
		// since handling it correctly would require modeling break/return/fall-through control flow.
		withImport('test("x", t => { switch (cond) { case 1: t.skip(); doStuff(); } });'),
	],
	invalid: [
		// Code after skip in the same block
		withImport('test("x", t => { t.skip(); assert.ok(x); });'),

		// Multi-line body — the suggested `return` matches the skip's indentation
		withImport('test("x", t => {\n\tt.skip();\n\tassert.ok(x);\n});'),

		// Conditional skip without return — outer code still runs
		withImport('test("x", t => { if (cond) { t.skip(); } assert.ok(x); });'),

		// The `.todo` variant behaves the same
		withImport('test("x", t => { t.todo(); assert.ok(x); });'),

		// Skip with a message argument
		withImport('test("x", t => { t.skip("not ready"); assert.ok(x); });'),

		// Renamed context parameter
		withImport('test("x", context => { context.skip(); doStuff(); });'),

		// Subtest context
		withImport('test("x", async t => { await t.test("child", t2 => { t2.skip(); doStuff(); }); });'),

		// Braceless `if` — reported, but no suggestion (a `return` would escape the condition)
		withImport('test("x", t => { if (cond) t.skip(); assert.ok(x); });'),

		// TypeScript
		{
			code: withImport('test("x", (t: any) => { t.skip(); assert.ok(x); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript wrapper on the call must not hide it
		{
			code: withImport('test("x", t => {\n\tt.skip() as void;\n\tassert.ok(x);\n});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

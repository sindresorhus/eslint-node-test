import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Nothing follows the skip in that static block, and a `return` after it is the pattern
		withImport('test("x", t => {\n\tclass A {\n\t\tstatic {\n\t\t\tdoStuff();\n\t\t\tt.skip();\n\t\t}\n\t}\n});'),
		withImport('test("x", t => {\n\tclass A {\n\t\tstatic {\n\t\t\tt.skip();\n\t\t\tthrow error;\n\t\t}\n\t}\n});'),
		// Not a test file
		'function f(t) { t.skip(); doStuff(); }',

		// Skip is the last statement — nothing runs after it
		withImport('test("x", t => { t.skip(); });'),
		withImport('test("x", t => { doStuff(); t.skip(); });'),
		// The walk climbs out of the `if` body, so a skip that is the last thing its test runs is fine
		withImport('test("x", t => { if (cond) { t.skip(); } });'),

		// Followed by return
		withImport('test("x", t => { if (cond) { t.skip(); return; } assert.ok(x); });'),

		// Followed by throw
		withImport('test("x", t => { if (cond) { t.skip(); throw new Error(); } assert.ok(x); });'),

		// A hook body gets a test context too, so a terminal skip there is fine
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.skip("nope"); });',

		// `skip` on something that is not a test context
		withImport('test("x", () => { other.skip(); doStuff(); });'),

		// A local variable shadowing the context name is not the test context
		withImport('test("x", t => { function helper() { const t = {skip() {}}; t.skip(); doStuff(); } });'),

		// The skip option object form is unaffected
		withImport('test("x", {skip: true}, t => { doStuff(); });'),

		// Best-effort limitation: code after a skip inside a `switch` case is not detected,
		// since handling it correctly would require modeling break/return/fall-through control flow.
		withImport('test("x", t => { switch (cond) { case 1: t.skip(); doStuff(); } });'),

		// A `break` right after the skip leaves the switch, so no test code runs after the skip.
		'import test from \'node:test\';\ntest(\'x\', t => {\n\tswitch (k) {\n\t\tcase 1: {\n\t\t\tt.skip(\'x\');\n\t\t\tbreak;\n\t\t}\n\t\tcase 2: {\n\t\t\tother();\n\t\t}\n\t}\n});',
	],
	invalid: [
		// A class static block is a statement list, so a skip in one is followed by the same code
		withImport('test("x", t => {\n\tclass A {\n\t\tstatic {\n\t\t\tt.skip();\n\t\t\tdoStuff();\n\t\t}\n\t}\n});'),
		// The walk climbs out of the class, so a statement after it still runs after the static block skipped
		withImport('test("x", t => { class A { static { t.skip(); } } doStuff(); });'),
		// A hook body gets a test context, so a skip there leaves the rest of the hook running
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.skip("nope"); doStuff(); });',
		// A `getTestContext()` under any local alias is named by the local name
		'import {test, getTestContext as gtc} from \'node:test\';\ntest(\'a\', () => { gtc().skip(\'r\'); work(); });',
		// Optional chaining does not hide the call
		withImport('test("x", t => { t?.skip(); assert.ok(x); });'),
		// A subtest created through `getTestContext()` has a tracked context of its own
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', () => { getTestContext().test(\'child\', t => { t.skip(); doStuff(); }); });',
		// The inserted `return` must land after a trailing comment, so the comment stays with the skip
		withImport('test("x", t => {\n\tt.skip(); // TODO: enable once fixed\n\tcheck();\n});'),
		withImport('test("x", t => {\n\tt.skip(/* why */);\n\tcheck();\n});'),
		// A comment on its own line is not the skip's trailing comment, so the `return` goes before it
		withImport('test("x", t => {\n\tt.skip();\n\t// why\n\tassert.ok(x);\n});'),

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

		// `getTestContext()` is the same test context, and a TypeScript wrapper on the receiver must
		// not hide the call
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', () => {\n\tgetTestContext().skip(\'why\');\n\tdoStuff();\n});',
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', () => {\n\tgetTestContext().todo(\'why\');\n\tdoStuff();\n});',
		{
			code: 'import {test} from \'node:test\';\ntest(\'a\', t => {\n\tt!.skip(\'why\');\n\tdoStuff();\n});',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {test} from \'node:test\';\ntest(\'a\', t => {\n\t(t as TestContext).skip(\'why\');\n\tdoStuff();\n});',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('test("x", (t: any) => { (t satisfies any).skip(); doStuff(); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

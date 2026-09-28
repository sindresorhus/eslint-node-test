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

		// Best-effort limitation: falling through into the next `switch` case is not followed
		withImport('test("x", t => { switch (cond) { case 1: t.skip(); case 2: doStuff(); } });'),

		// A `break` right after the skip leaves the switch, so no test code runs after the skip.
		'import test from \'node:test\';\ntest(\'x\', t => {\n\tswitch (k) {\n\t\tcase 1: {\n\t\t\tt.skip(\'x\');\n\t\t\tbreak;\n\t\t}\n\t\tcase 2: {\n\t\t\tother();\n\t\t}\n\t}\n});',
		'// Nothing runs after the loop, so the jump really is terminal here\nimport {test} from \'node:test\';\ntest(\'a\', t => {\n	for (const x of xs) {\n		t.skip();\n		break;\n	}\n});',
		// A `break` exits the whole loop, switch, or labeled statement, so the code it skips over does not run after the skip
		withImport('test("a", t => {\n\tfor (const item of items) {\n\t\tif (!item.ok) {\n\t\t\tt.skip("bad");\n\t\t\tbreak;\n\t\t}\n\n\t\tcheck(item);\n\t}\n});'),
		withImport('test("a", t => {\n\twhile (next()) {\n\t\tif (bad) {\n\t\t\tt.skip();\n\t\t\tbreak;\n\t\t}\n\n\t\tcheck();\n\t}\n});'),
		withImport('test("a", t => {\n\tswitch (kind) {\n\t\tcase 1: {\n\t\t\tif (bad) {\n\t\t\t\tt.skip();\n\t\t\t\tbreak;\n\t\t\t}\n\n\t\t\tcheck();\n\t\t}\n\t}\n});'),
		withImport('test("a", t => {\n\touter: for (const row of rows) {\n\t\tfor (const cell of row) {\n\t\t\tt.skip();\n\t\t\tbreak outer;\n\t\t}\n\n\t\tcheck(row);\n\t}\n});'),
	],
	invalid: [
		// A discarded `t.skip()` still skips, so the code after it still runs
		withImport('test("x", t => { void t.skip("nope"); doStuff(); });'),
		withImport('test("x", t => { if (flag) { void t.skip("nope"); } doStuff(); });'),

		// A skip inside `&&`, `?:`, or a sequence may not run, so it is reported without a suggestion: an unconditional `return` after the statement would stop the test when it does not skip
		withImport('test("x", t => {\n\tflag && t.skip();\n\tdoStuff();\n});'),
		withImport('test("x", t => {\n\tflag ? t.skip() : null;\n\tdoStuff();\n});'),
		withImport('test("x", t => {\n\tflag && void t.skip();\n\tdoStuff();\n});'),
		withImport('test("x", t => {\n\tprepare(), t.skip();\n\tdoStuff();\n});'),
		withImport('test("x", t => {\n\tvoid t.skip();\n\tdoStuff();\n});'),

		// A class static block is a statement list, so a skip in one is followed by the same code
		withImport('test("x", t => {\n\tclass A {\n\t\tstatic {\n\t\t\tt.skip();\n\t\t\tdoStuff();\n\t\t}\n\t}\n});'),
		withImport('test("x", t => {\n\tclass A {\n\t\tstatic {\n\t\t\tif (x) {\n\t\t\t\tt.skip();\n\t\t\t\tdoStuff();\n\t\t\t}\n\t\t}\n\t}\n});'),
		withImport('test("x", t => {\n\tclass A {\n\t\tstatic {\n\t\t\tfor (const item of items) {\n\t\t\t\tt.skip();\n\t\t\t\tdoStuff();\n\t\t\t}\n\t\t}\n\t}\n});'),
		withImport('test("x", t => {\n\tclass A {\n\t\tstatic {\n\t\t\ttry {\n\t\t\t\tt.skip();\n\t\t\t\tdoStuff();\n\t\t\t} catch {}\n\t\t}\n\t}\n});'),
		withImport('test("x", t => {\n\tclass A {\n\t\tstatic {\n\t\t\t{ t.skip(); doStuff(); }\n\t\t}\n\t}\n});'),
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
		'// A `break` leaves the loop, not the test, so the code after it still runs\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'test(\'a\', t => {\n'
		+ '	for (const x of xs) {\n'
		+ '		t.skip();\n'
		+ '		break;\n'
		+ '	}\n'
		+ '	doSomething();\n'
		+ '});',
		'import {test} from \'node:test\';\ntest(\'a\', t => {\n	for (const x of xs) {\n		t.skip();\n		continue;\n	}\n	doSomething();\n});',
		'import {test} from \'node:test\';\ntest(\'a\', t => {\n	switch (x) {\n		case 1:\n			t.skip();\n			break;\n	}\n	doSomething();\n});',
		// A `continue` only ends this iteration, so the later iterations still run the code after the skip
		withImport('test("a", t => {\n\tfor (const item of items) {\n\t\tif (!item.ok) {\n\t\t\tt.skip("bad");\n\t\t\tcontinue;\n\t\t}\n\n\t\tcheck(item);\n\t}\n});'),
		// A `break` out of the inner loop only, or out of a labeled block, still leaves code after it
		withImport('test("a", t => {\n\tfor (const row of rows) {\n\t\tfor (const cell of row) {\n\t\t\tt.skip();\n\t\t\tbreak;\n\t\t}\n\n\t\tcheck(row);\n\t}\n});'),
		withImport('test("a", t => {\n\tblock: {\n\t\tt.skip();\n\t\tbreak block;\n\t}\n\n\tcheck();\n});'),
		// The `getTestContext` a default or namespace import carries is named as the file writes it
		'import test from \'node:test\';\ntest(\'a\', () => { test.getTestContext().skip(\'r\'); work(); });',
		'import * as nt from \'node:test\';\nnt.test(\'a\', () => { nt.getTestContext().skip(\'r\'); work(); });',
		// A `switch` case is a statement list too, braces or not
		withImport('test("x", t => { switch (cond) { case 1: t.skip(); doStuff(); } });'),
		withImport('test("x", t => {\n\tswitch (cond) {\n\t\tcase 1:\n\t\t\tt.skip();\n\t\t\tdoStuff();\n\t}\n});'),
	],
});

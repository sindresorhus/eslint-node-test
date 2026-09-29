import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test from 'node:test';\n${code}`;
const withHookImport = code => `import test, {beforeEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// A destructuring declarator binds a property read off the chain (destructuring does not await), not the chain itself
		withImport('test("title", t => { const {length} = foo().then(fn); return length; });'),
		withImport('test("title", t => { const [first] = foo().then(fn); return first; });'),
		withImport('test("title", t => { const {then} = foo().then(fn); return then; });'),

		// A compound assignment produces a string, whatever the chain on its right returns
		withImport('test("title", t => { let bar; bar += foo().then(fn); return bar; });'),

		// Not a test file — no import from node:test
		'test(t => { return foo().then(fn); });',
		// Does not return anything
		withImport('test("title", t => { foo(); });'),
		// Returns non-promise value
		withImport('test("title", t => { return foo(); });'),
		// Calls .then() but does not return it
		withImport('test("title", t => { foo().then(fn); });'),
		// Promise chain without `.then()` — the rule intentionally only targets `.then()` chains
		withImport('test("title", t => { return foo().catch(fn); });'),
		withImport('test("title", t => { return foo().finally(fn); });'),
		// Already async — not flagged (rule targets non-async returning a promise)
		withImport('test("title", async t => { return foo().then(fn); });'),
		// `describe`/`suite` callbacks run synchronously and are never awaited — not flagged
		'import {describe} from "node:test";\ndescribe("group", () => { return foo().then(fn); });',
		// Arrow shorthand (no block body) — no block statement to inspect
		withImport('test("title", t => foo().then(fn));'),
		// .then() inside nested function — not a return from the test callback
		withImport('test("title", t => { function foo() { return bar().then(fn); } });'),
		withImport('test("title", t => { const foo = () => { return bar().then(fn); }; t.pass(); });'),
		withImport('test("title", t => { const foo = function() { return bar().then(fn); }; t.pass(); });'),
		// Returned var not assigned from .then()
		withImport('test("title", t => { const bar = foo(); return bar; });'),
		// Variable assigned from .then() but not returned
		withImport('test("title", t => { let bar; bar = foo().then(fn); return; });'),
		// A destructuring pattern binds a name without an initializer to inspect
		withImport('test("title", t => { const {then} = foo(); return then; });'),
		// A computed property is not read as the `.then()` method
		withImport('test("title", t => { return foo[\'then\'](fn); });'),
		// An unresolved identifier has no definition that could come from a `.then()` call
		withImport('test("title", t => { return chainResult; });'),
		// Empty return
		withImport('test("title", t => { return; });'),
		// Named import
		'import {it} from "node:test";\nit("title", t => { foo(); });',
		// A callback that is only referenced cannot be read
		withImport('test("title", callback);'),

		// A hook whose first argument is not a function never runs, so a function in a later slot is dead code, and the runner never reads `options.fn` for a hook either
		withHookImport('beforeEach({}, () => { return p.then(x => x); });'),
		withHookImport('beforeEach({fn() { return p.then(x => x); }});'),
		withHookImport('test.beforeEach({}, () => { return p.then(x => x); });'),
		withHookImport('test.beforeEach({fn() { return p.then(x => x); }});'),
		withImport('test(\'title\', t => { t.beforeEach({}, () => { return p.then(x => x); }); });'),
		withImport('test(\'title\', t => { t.beforeEach({fn() { return p.then(x => x); }}); });'),
	],
	invalid: [
		// A variable reassigned from a chain holds it just as a declaration does The declarator that binds the promise alongside a destructuring one still counts
		withImport('test("title", t => { const {a} = {a: 1}, bar = foo().then(fn); return bar; });'),

		withImport('test("title", t => { let bar; bar = foo().then(fn); return bar; });'),
		withImport('test("title", t => { let bar = other; bar = foo().then(fn); return bar; });'),

		// Basic: return .then()
		withImport('test("title", t => { return foo().then(fn); });'),
		// Function expression
		withImport('test("title", function(t) { return foo().then(fn); });'),
		// Chained .then().catch()
		withImport('test("title", t => { return foo().then(fn).catch(fn2); });'),
		// Chained .catch().then()
		withImport('test("title", t => { return foo().catch(fn2).then(fn); });'),
		// Variable from .then() returned
		withImport('test("title", t => { const bar = foo().then(fn); return bar; });'),
		// Variable (let) from .then() returned
		withImport('test("title", t => { let bar = foo().then(fn); return bar; });'),
		// .then() on var (not from definition)
		withImport('test("title", t => { const bar = foo(); return bar.then(fn); });'),
		// Optional chaining
		withImport('test("title", t => { return promise?.then(fn); });'),
		withImport('test("title", t => { return foo?.().then(fn); });'),
		withImport('test("title", t => { return foo?.bar().then(fn); });'),
		withImport('test("title", t => { return foo?.bar()?.then(fn); });'),
		withImport('test("title", t => { const bar = foo?.().then(fn); return bar; });'),
		// Conditional return
		withImport('test("title", t => { if (cond) { return bar.then(fn); } });'),
		withImport('test("title", t => { if (cond) { return; } else { return bar.then(fn); } });'),
		// Switch case
		withImport('test("title", t => { switch (x) { case 1: return bar.then(fn); } });'),
		// Try/catch
		withImport('test("title", t => { try { return bar.then(fn); } catch {} });'),
		withImport('test("title", t => { try {} catch { return bar.then(fn); } });'),
		withImport('test("title", t => { try {} finally { return bar.then(fn); } });'),
		// Loop
		withImport('test("title", t => { for (let i = 0; i < 10; i++) { return bar.then(fn); } });'),
		withImport('test("title", t => { while (true) { return bar.then(fn); } });'),
		withImport('test("title", t => { do { return bar.then(fn); } while (cond); });'),
		withImport('test("title", t => { for (const item of list) { return item.then(fn); } });'),
		withImport('test("title", t => { for (const key in object) { return key.then(fn); } });'),
		// A labeled block is a statement the walk descends through
		withImport('test("title", t => { outer: { return bar.then(fn); } });'),
		// Control flow nested inside control flow
		withImport('test("title", t => { while (again) { if (done) { return bar.then(fn); } } });'),
		// The default case of a switch, which has no test to guard it
		withImport('test("title", t => { switch (x) { default: return bar.then(fn); } });'),
		// Named import — it()
		'import {it} from "node:test";\nit("title", t => { return foo().then(fn); });',
		// The object-descriptor form, where the callback is the `fn` property
		'import test from "node:test";\ntest({name: "title", fn() { return foo().then(fn); }});',
		// The callback in the third slot, behind the options object
		withImport('test("title", {skip: true}, t => { return foo().then(fn); });'),
		// The runner reads the `fn` option first, so a later positional callback never runs
		withImport('test("title", {fn: t => { return foo().then(fn); }}, t => {});'),
		// Hook callbacks are awaited by node:test, so returning a `.then()` chain is flagged too
		'import {before} from "node:test";\nbefore(() => { return setup().then(fn); });',
		'import {beforeEach} from "node:test";\nbeforeEach(() => { return setup().then(fn); });',
		// Namespace import
		'import * as nodeTest from "node:test";\nnodeTest.test("title", t => { return foo().then(fn); });',
		// Renamed import
		'import {test as t} from "node:test";\nt("title", fn => { return foo().then(fn); });',
		// TypeScript: type cast on callback
		{
			code: 'import test from "node:test";\ntest("title", (t => { return foo().then(fn); }) as any);',
			languageOptions: {parser: parsers.typescript},
		},
		// TypeScript: a type assertion around the returned chain must not hide the `.then()`
		{
			code: 'import test from "node:test";\ntest("title", t => { return (foo().then(fn)) as Promise<void>; });',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from "node:test";\ntest("title", t => { return <Promise<void>>foo().then(fn); });',
			languageOptions: {parser: parsers.typescript},
		},
		// TypeScript: a wrapped variable initializer is still recognized as assigned from `.then()`
		{
			code: 'import test from "node:test";\ntest("title", t => { const bar = (foo().then(fn)) as any; return bar; });',
			languageOptions: {parser: parsers.typescript},
		},
		// TypeScript: a non-null assertion in the middle of the chain
		{
			code: 'import test from "node:test";\ntest("title", t => { return foo!.then(fn); });',
			languageOptions: {parser: parsers.typescript},
		},
		withImport('test(\'x\', async t => { await t.test(\'y\', () => { return f().then(d => d); }); });'),

		// A hook declared on a test context is a callback node:test awaits, exactly like an imported one
		'import {test} from \'node:test\';\ntest(\'o\', t => {\n\tt.beforeEach(() => {\n\t\treturn setup().then(fn);\n\t});\n});',
		'import {test} from \'node:test\';\ntest(\'o\', t => {\n\tt.after(() => {\n\t\treturn setup().then(fn);\n\t});\n});',
		'import {test} from \'node:test\';\ntest(\'o\', t => {\n\tt.afterEach(() => {\n\t\treturn setup().then(fn);\n\t});\n});',
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
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
		// Empty return
		withImport('test("title", t => { return; });'),
		// Named import
		'import {it} from "node:test";\nit("title", t => { foo(); });',
	],
	invalid: [
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
		// Named import — it()
		'import {it} from "node:test";\nit("title", t => { return foo().then(fn); });',
		// Hook callbacks are awaited by node:test, so returning a `.then()` chain is flagged too
		'import {before} from "node:test";\nbefore(() => { return setup().then(fn); });',
		// Namespace import
		'import * as nodeTest from "node:test";\nnodeTest.test("title", t => { return foo().then(fn); });',
		// Renamed import
		'import {test as t} from "node:test";\nt("title", fn => { return foo().then(fn); });',
		// TypeScript: type cast on callback
		{
			code: 'import test from "node:test";\ntest("title", (t => { return foo().then(fn); }) as any);',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

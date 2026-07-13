import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

// Helper: wrap code with a node:test import
const withImport = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file — no import from node:test
		'test(async t => {});',
		// Sync callback — no async keyword
		withImport('test("title", t => {});'),
		withImport('test("title", function(t) {});'),
		// Async WITH await — should not be flagged
		withImport('test("title", async t => { await foo(); });'),
		withImport('test("title", async function(t) { await foo(); });'),
		withImport('test("title", async t => { t.is(await foo(), 1); });'),
		withImport('test("title", async t => { if (bar) { await foo(); } });'),
		withImport('test("title", async t => { if (bar) {} else { await foo(); } });'),
		// For-await-of
		withImport('test("title", async t => { for await (const x of gen()) {} });'),
		// Await inside nested async function is NOT counted — but the outer function also awaits
		withImport('test("title", async t => { await foo(); const helper = async () => { await bar(); }; });'),
		// Hooks with await are valid
		withImport('import {before} from "node:test";\nbefore(async () => { await setup(); });'),
		withImport('import {afterEach} from "node:test";\nafterEach(async () => { await cleanup(); });'),
		// It() alias with await
		withImport('import {it} from "node:test";\nit("title", async t => { await foo(); });'),
		// Passing a non-inline function ref — no callback to inspect
		withImport('const fn = async t => { foo(); };\ntest("title", fn);'),
		// No callback at all
		withImport('test("title");'),
		// Shadowed import name
		withImport('function helper(test) {\n\ttest("local", async () => {});\n}\nhelper(localTest);'),
		// Async suite callbacks are out of scope (owned by `no-async-describe`)
		withImport('import {describe} from "node:test";\ndescribe("s", async () => {});'),
		withImport('import {suite} from "node:test";\nsuite("s", async () => {});'),
		// Global assertion configuration is not a test registration.
		withImport('test.assert.register("custom", async () => {});'),
		// A bare `test` package is not Node's test runner.
		'import test from "test";\ntest("title", async t => {});',
	],
	invalid: [
		// Basic async arrow with no await
		withImport('test("title", async t => {});'),
		// Basic async function expression with no await
		withImport('test("title", async function(t) {});'),
		// No title
		withImport('test(async t => {});'),
		// Named import
		'import {test} from "node:test";\ntest("title", async t => {});',
		// Renamed import
		'import {test as t} from "node:test";\nt("title", async fn => {});',
		// Namespace import
		'import * as nodeTest from "node:test";\nnodeTest.test("title", async t => {});',
		// It() alias
		'import {it} from "node:test";\nit("title", async t => {});',
		// Before() hook
		'import {before} from "node:test";\nbefore(async () => {});',
		// AfterEach() hook
		'import {afterEach} from "node:test";\nafterEach(async () => { foo(); });',
		// Await inside nested function does not count — outer is async without await
		withImport('test("title", async t => { async function helper() { await foo(); } });'),
		withImport('test("title", async t => { const helper = async () => { await foo(); }; });'),
		// For-await inside nested function does not count
		withImport('test("title", async t => { async function helper() { for await (const x of gen()) {} } });'),
		// TypeScript: async arrow with type annotation
		{
			code: 'import test from "node:test";\ntest("title", async (t: unknown) => {});',
			languageOptions: {parser: parsers.typescript},
		},
		// Two tests: only the second lacks await
		withImport('test("a", async t => { await foo(); });\ntest("b", async t => {});'),
	],
});

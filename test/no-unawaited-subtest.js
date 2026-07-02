import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'function f(t) { t.test("x", () => {}); }',

		// Awaited subtest
		withImport('test("parent", async t => { await t.test("child", () => {}); });'),

		// Returned subtest
		withImport('test("parent", t => t.test("child", () => {}));'),
		withImport('test("parent", t => { return t.test("child", () => {}); });'),

		// Result used (assigned/chained)
		withImport('test("parent", async t => { const p = t.test("child", () => {}); await p; });'),
		withImport('test("parent", t => { t.test("child", () => {}).then(() => {}); });'),

		// Awaited via Promise.all
		withImport('test("parent", async t => { await Promise.all([t.test("a", () => {}), t.test("b", () => {})]); });'),

		// `t.test` where `t` is not a test context parameter
		withImport('test("parent", () => { t.test("child", () => {}); });'),

		// A plain `test()` call (imported binding), not a subtest
		withImport('test("a", () => {}); test("b", () => {});'),

		// Renamed context parameter, awaited
		withImport('test("parent", async context => { await context.test("child", () => {}); });'),
	],
	invalid: [
		// Floating subtest in an async parent — autofixable
		withImport('test("parent", async t => { t.test("child", () => {}); });'),

		// Floating subtest in a sync parent — no autofix (await would be invalid)
		withImport('test("parent", t => { t.test("child", () => {}); });'),

		// Multiple floating subtests
		withImport('test("parent", async t => { t.test("a", () => {}); t.test("b", () => {}); });'),

		// Renamed context parameter
		withImport('test("parent", async context => { context.test("child", () => {}); });'),

		// Modifier-chained subtest (`t.test.skip`) floating
		withImport('test("parent", async t => { t.test.skip("child", () => {}); });'),

		// Nested subtest floating
		withImport('test("parent", async t => { await t.test("child", async t2 => { t2.test("grandchild", () => {}); }); });'),

		// `it` alias as the parent
		withImport('import {it} from \'node:test\';\nit("parent", async t => { t.test("child", () => {}); });'),

		// TypeScript
		{
			code: withImport('test("parent", async (t: any) => { t.test("child", () => {}); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

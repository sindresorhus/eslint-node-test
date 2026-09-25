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
		withImport('test("parent", t => { setTimeout(() => { t.test("child", () => {}); }); });'),
		withImport('test("parent", t => { load().then(() => { t.test("child", () => {}); }); });'),
		withImport('test("parent", t => { new Promise(resolve => { setTimeout(() => { t.test("child", () => {}); resolve(); }); }); });'),
		withImport('test("parent", t => { void new Promise(resolve => { setTimeout(() => { t.test("child", () => {}); resolve(); }); }); });'),
		withImport('test("parent", () => { setTimeout(); });'),

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

		// TypeScript wrapper must not hide a floating subtest. Reported without a fix: `as` binds
		// looser than `await`, so the inserted `await` would cast the awaited value, not the Promise.
		{
			code: withImport('test("parent", async t => { t.test("child", () => {}) as Promise<void>; });'),
			languageOptions: {parser: parsers.typescript},
		},

		// Optional-chained subtest — `ChainExpression` on both callee and statement sides
		withImport('test("parent", async t => { t?.test("child", () => {}); });'),

		// Explicitly discarded with `void` — still unawaited, reported without an autofix
		withImport('test("parent", async t => { void t.test("child", () => {}); });'),
		// A conditional, logical, or sequence expression that hands the subtest's value to a statement
		// discards it, exactly as a bare statement does
		withImport('test("parent", async t => {\n\tcondition ? t.test("child", () => {}) : null;\n});'),
		withImport('test("parent", async t => {\n\tcondition && t.test("child", () => {});\n});'),
		withImport('test("parent", async t => {\n\t(0, t.test("child", () => {}));\n});'),
		withImport('test("parent", async t => {\n\tvoid (condition ? t.test("child", () => {}) : null);\n});'),
		withImport('test("parent", async t => {\n\tt.test("child", () => {}) ? 1 : 2;\n});'),
		withImport('test("parent", t => { void t.test("child", () => {}); });'),
		{
			code: withImport('test("parent", async t => { void (t.test("child", () => {}) as any); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// A bare-statement subtest in an iteration callback belongs to this rule, not to
		// `require-await-concurrent-subtests`, whose valid cases point here for exactly this shape.
		withImport('test("parent", async t => { xs.forEach(x => { t.test(x, () => {}); }); });'),

		// Cases intentionally not handled by `no-late-test-activity`.
		withImport('test("parent", t => { setTimeout(() => { function create() { t.test("child", () => {}); } create(); }); });'),
		withImport('test("parent", t => { function schedule() { setTimeout(() => { t.test("child", () => {}); }); } schedule(); });'),
		withImport('test("parent", t => { load().then(() => { setTimeout(() => { t.test("child", () => {}); }); }); });'),
		withImport('test("parent", async t => { await new Promise(resolve => { setTimeout(() => { t.test("child", () => {}); resolve(); }); }); });'),
		withImport('test("parent", (t, done) => { setTimeout(() => { t.test("child", () => {}); done(); }); });'),
		withImport('test("parent", (t, done) => { load().then(() => { t.test("child", () => {}); done(); }); });'),
		withImport('test("parent", t => { t.plan(1, {wait: true}); setTimeout(() => { t.test("child", () => {}); t.assert.ok(true); }); });'),
		// A class static block sits between the subtest and the async function, where `await` is a
		// syntax error, so the problem is reported but no fix is offered.
		withImport('test(\'p\', async t => { class C { static { t.test(\'c\', () => {}); } } });'),

		// A subtest created through `getTestContext()` is cancelled the same way
		'import {test, getTestContext} from \'node:test\';\ntest(\'parent\', async () => {\n\tgetTestContext().test(\'child\', () => {});\n});',
		'import {test, getTestContext} from \'node:test\';\ntest(\'parent\', () => {\n\tgetTestContext().test(\'child\', () => {});\n});',
		'import {test, getTestContext} from \'node:test\';\ntest(\'parent\', async () => {\n\tclass C { static { getTestContext().test(\'child\', () => {}); } }\n});',

		// A hook callback is handed the context of the test it runs for, so a subtest created there
		// is cancelled the same way
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.test(\'c\', () => {}); });',
		'import {getTestContext, beforeEach} from \'node:test\';\nbeforeEach(t => { getTestContext().test(\'c\', () => {}); });',
	],
});

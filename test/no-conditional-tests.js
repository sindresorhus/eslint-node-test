import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, describe, it} from 'node:test';\n${code}`;
const withHookImport = code => `import {beforeEach, afterEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// A definition inside a hook is `no-test-inside-hook`'s to report, since its fix has to come first and this rule's advice would leave that report in place
		'import {test, before} from \'node:test\';\nbefore(() => { if (x) { test("a", () => {}); } });',
		'import {test, beforeEach} from \'node:test\';\nbeforeEach(() => { if (x) { test("a", () => {}); } });',
		'import test from \'node:test\';\ntest("a", t => { t.beforeEach(() => { if (x) { t.test("b", () => {}); } }); });',

		// Not a test file
		'if (x) { test("a", () => {}); }',

		// Unconditional registration
		withImport('test("a", () => {});'),
		withImport('describe("s", () => { it("a", () => {}); });'),

		// Loop — the idiomatic way to parameterize tests, allowed
		withImport('for (const c of cases) { test(c.name, () => {}); }'),
		withImport('cases.forEach(c => { test(c.name, () => {}); });'),

		// Condition inside the test body is fine (not registration)
		withImport('test("a", () => { if (x) { assert.ok(y); } });'),

		// Condition inside the hook body is fine (not registration)
		withHookImport('beforeEach(() => { if (x) { setup(); } });'),

		// A loop inside a describe
		withImport('describe("s", () => { for (const c of cases) { it(c.name, () => {}); } });'),

		// Callback call-site conditions are not traced
		withImport('if (x) { cases.forEach(c => { test(c.name, () => {}); }); }'),

		// A context hook registered conditionally in a test body is conditional cleanup for that one test
		'import test from \'node:test\';\ntest(\'x\', t => {\n\tconst server = maybeStart();\n\tif (server) {\n\t\tt.after(() => server.close());\n\t}\n});',
		'import test from \'node:test\';\ntest(\'x\', t => {\n\tdir && t.after(() => rm(dir));\n});',
		// An imported hook called in a test body registers on that test, the same as `t.after`
		'import {test, after} from \'node:test\';\ntest(\'x\', () => {\n\tif (server) {\n\t\tafter(() => server.close());\n\t}\n});',
	],
	invalid: [
		// If statement
		withImport('if (x) { test("a", () => {}); }'),
		withImport('if (x) test("a", () => {});'),

		// Else branch
		withImport('if (x) { test("a", () => {}); } else { test("b", () => {}); }'),

		// Logical guard (common CI gate)
		withImport('process.env.CI && test("a", () => {});'),

		// Logical `||` guard
		withImport('skipSuite || test("a", () => {});'),

		// Logical `??` guard
		withImport('maybeTest ?? test("a", () => {});'),

		// Ternary
		withImport('cond ? test("a", () => {}) : test("b", () => {});'),

		// Switch case
		withImport('switch (x) { case 1: test("a", () => {}); break; }'),

		// Conditional describe
		withImport('if (x) { describe("s", () => {}); }'),
		'import {suite} from \'node:test\';\nif (x) { suite("s", () => {}); }',

		// Conditional registration inside a describe body
		withImport('describe("s", () => { if (x) { it("a", () => {}); } });'),

		// Conditional hook registration
		withHookImport('if (x) { beforeEach(() => {}); }'),
		withHookImport('process.env.CI && afterEach(() => cleanup());'),
		'import {before as setup} from \'node:test\';\nif (x) { setup(() => {}); }',
		'import * as nodeTest from \'node:test\';\nswitch (x) { case 1: nodeTest.after(() => {}); break; }',
		'import test from \'node:test\';\nif (x) { test.beforeEach(() => {}); }',

		// Inside a loop that is itself inside a condition — still conditional
		withImport('if (x) { for (const c of cases) { test(c.name, () => {}); } }'),

		// TypeScript
		{
			code: withImport('if (x) { test("a", () => {}); }'),
			languageOptions: {parser: parsers.typescript},
		},

		// A `catch` body only runs when the `try` block throws, so a registration there is as runtime-dependent as one in an `if`. A `finally` body always runs.
		'import {before} from \'node:test\';\ntry { risky(); } catch { before(() => { setup(); }); }',
		'import {test} from \'node:test\';\ntry { risky(); } catch { test(\'only on failure\', () => {}); }',

		// A hook declared through `getTestContext()` is the same hook
		'import {test, getTestContext} from \'node:test\';\nif (x) { getTestContext().beforeEach(() => {}); }',

		// A TypeScript `this` parameter is erased at compile time, so the subtest is still a subtest
		{
			code: withImport('test(\'a\', (this: void, t) => { if (x) { t.test(\'b\', () => {}); } });'),
			languageOptions: {parser: parsers.typescript},
		},

		// `no-test-inside-hook` does not report a hook registered inside a hook, so a condition around it is still this rule's to report
		'import {before, after} from \'node:test\';\nbefore(() => { if (x) { after(() => {}); } });',
		'import test from \'node:test\';\ntest.before(() => { if (x) { test.after(() => {}); } });',
		'import {test} from \'node:test\';\ntest(\'a\', t => { t.before(() => { if (x) { t.after(() => {}); } }); });',
	],
});

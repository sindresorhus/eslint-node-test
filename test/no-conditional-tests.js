import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, describe, it} from 'node:test';\n${code}`;
const withHookImport = code => `import {beforeEach, afterEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
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
	],
});

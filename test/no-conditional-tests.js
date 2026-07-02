import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, describe, it} from 'node:test';\n${code}`;

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

		// A loop inside a describe
		withImport('describe("s", () => { for (const c of cases) { it(c.name, () => {}); } });'),

		// Hooks are intentionally not flagged — conditionally registering a hook is a common, valid pattern
		'import {beforeEach} from \'node:test\';\nif (x) { beforeEach(() => {}); }',
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

		// Ternary
		withImport('cond ? test("a", () => {}) : test("b", () => {});'),

		// Switch case
		withImport('switch (x) { case 1: test("a", () => {}); break; }'),

		// Conditional describe
		withImport('if (x) { describe("s", () => {}); }'),

		// Conditional registration inside a describe body
		withImport('describe("s", () => { if (x) { it("a", () => {}); } });'),

		// Inside a loop that is itself inside a condition — still conditional
		withImport('if (x) { for (const c of cases) { test(c.name, () => {}); } }'),

		// TypeScript
		{
			code: withImport('if (x) { test("a", () => {}); }'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

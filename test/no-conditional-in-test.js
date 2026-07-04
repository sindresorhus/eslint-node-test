import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, describe, beforeEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'test("x", () => { if (a) { b(); } });',

		// No conditional
		withImport('test("x", () => { assert.ok(a); });'),

		// Conditional in a `describe` body is registration logic (no-conditional-tests covers it)
		withImport('describe("s", () => { if (a) { test("x", () => {}); } });'),

		// Conditional outside any test
		withImport('if (a) { b(); }\ntest("x", () => {});'),

		// Conditional in a test-deciding argument, not inside the test body
		withImport('test("x", a ? f : g);'),

		// Conditional in the options object, not inside the test body
		withImport('test("x", {skip: a ? "reason" : false}, () => {});'),

		// Conditional inside a nested helper function, not directly in the test body
		withImport('test("x", () => { const helper = () => { if (a) { f(); } }; helper(); });'),
	],
	invalid: [
		// `if` in a test body
		withImport('test("x", () => { if (a) { assert.ok(b); } });'),

		// `if`/`else`
		withImport('test("x", () => { if (a) { f(); } else { g(); } });'),

		// Ternary in a test body
		withImport('test("x", () => { const value = a ? 1 : 2; });'),

		// `switch` in a test body
		withImport('test("x", () => { switch (a) { case 1: break; } });'),

		// Conditional in a hook body
		withImport('beforeEach(() => { if (a) { setup(); } });'),

		// Conditional inside a nested describe -> test body
		withImport('describe("s", () => { test("x", () => { if (a) { f(); } }); });'),

		// `it` alias
		'import {it} from \'node:test\';\nit("x", () => { if (a) { f(); } });',

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test("x", () => { if (a) { f(); } });',

		// TypeScript
		{
			code: withImport('test("x", () => { if (a as boolean) { f(); } });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

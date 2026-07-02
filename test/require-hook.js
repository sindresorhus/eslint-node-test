import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, describe, beforeEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'startServer();',

		// Setup inside a hook — the recommended place
		withImport('beforeEach(() => { startServer(); });\ntest("x", () => {});'),

		// Call inside a test body
		withImport('test("x", () => { startServer(); });'),

		// Call inside a helper function (not a registration scope)
		withImport('function setup() { startServer(); }\ntest("x", () => { setup(); });'),

		// Registration calls themselves
		withImport('test("x", () => {});'),
		withImport('describe("s", () => { test("x", () => {}); });'),

		// Variable declarations are allowed (only bare calls are flagged)
		withImport('const server = startServer();\ntest("x", () => {});'),

		// Assertions are reported by no-assert-in-describe, not here
		'import {describe} from \'node:test\';\nimport assert from \'node:assert\';\ndescribe("s", () => { assert.ok(a); });',

		// Allowed via the `allow` option
		{
			code: withImport('log("loaded");\ntest("x", () => {});'),
			options: [{allow: ['log']}],
		},
		{
			code: withImport('console.log("loaded");\ntest("x", () => {});'),
			options: [{allow: ['console.log']}],
		},
	],
	invalid: [
		// Bare setup call at the module top level
		withImport('startServer();\ntest("x", () => {});'),

		// Setup call directly in a describe body
		withImport('describe("s", () => { seedData(); test("x", () => {}); });'),

		// Member-expression setup call
		withImport('database.connect();\ntest("x", () => {});'),

		// Nested describe body
		withImport('describe("s", () => { describe("inner", () => { seedData(); test("x", () => {}); }); });'),

		// Not in the allow list
		{
			code: withImport('log("loaded");\ntest("x", () => {});'),
			options: [{allow: ['debug']}],
		},

		// TypeScript
		{
			code: withImport('startServer();\ntest("x", () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

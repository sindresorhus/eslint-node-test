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

		// The registration-call and assertion exemptions survive the value-discarding wrapper
		'import test, {before} from \'node:test\';\nawait before(() => {});\ntest("x", () => {});',
		'import test, {describe} from \'node:test\';\nvoid describe("s", () => {});\ntest("x", () => {});',
		'import test from \'node:test\';\nimport assert from \'node:assert\';\nawait assert.ok(a);\ntest("x", () => {});',

		// `typeof` on a bare identifier reads a binding, it does not call anything
		withImport('typeof startServer;\ntest("x", () => {});'),

		// A call assigned to a variable is a declaration, handled by the valid case above
		withImport('const server = await startServer();\ntest("x", () => {});'),

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

		// A discarded or awaited return value does not move the call out of the load phase
		withImport('await startServer();\ntest("x", () => {});'),
		withImport('await database.connect();\ntest("x", () => {});'),
		withImport('void startServer();\ntest("x", () => {});'),
		withImport('!startServer();\ntest("x", () => {});'),
		withImport('void database.connect();\ntest("x", () => {});'),

		// Inside a suite body too
		withImport('describe("s", async () => { await seedData(); test("x", () => {}); });'),
		withImport('describe("s", () => { void seedData(); test("x", () => {}); });'),

		// The `allow` list still applies through the wrapper
		{
			code: withImport('await log("loaded");\ntest("x", () => {});'),
			options: [{allow: ['debug']}],
		},

		// Optional chaining is an expression wrapper too. Walking up from it instead of unwrapping
		// down used to loop forever, so these are here to keep the walk finite.
		withImport('await server?.start();\ntest("x", () => {});'),
		withImport('void server?.start();\ntest("x", () => {});'),
		withImport('!server?.start();\ntest("x", () => {});'),
		withImport('typeof server?.start?.();\ntest("x", () => {});'),

		// A TypeScript wrapper under `await` unwraps the same way
		{
			code: withImport('await (startServer() as Promise<void>);\ntest("x", () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('void (startServer() as unknown);\ntest("x", () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		// The descriptor / options.fn suite forms still run the body at load time
		'import {describe} from \'node:test\';\ndescribe({name: \'a\', fn() { setup(); }});',
		'import {describe} from \'node:test\';\ndescribe(\'a\', {fn() { setup(); }});',
		'import {suite} from \'node:test\';\nsuite(\'a\', {fn() { setup(); }});',
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test from 'node:test';\nimport assert from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file — a top-level runtime assertion is a legitimate guard
		'import assert from \'node:assert\';\nassert.ok(process.version);',

		// Inside a test callback
		withImport('test("x", () => { assert.ok(value); });'),

		// Inside a hook
		'import test, {beforeEach} from \'node:test\';\nimport assert from \'node:assert\';\nbeforeEach(() => { assert.ok(value); });',

		// Inside a helper function (may be called from a test)
		withImport('function check(value) { assert.ok(value); }\ntest("x", () => { check(1); });'),

		// Test context assertion inside a test
		withImport('test("x", t => { t.assert.ok(value); });'),

		// A `.assert.*` call on an unrelated object is not a `node:assert` assertion
		withImport('myDb.assert.ok(value);'),

		// An instance class field initializer runs when an instance is created, not at module load
		withImport('class C { field = assert.ok(value); }'),
		withImport('class C { get field() { return assert.ok(value); } }'),
		withImport('class C { [name] = assert.ok(value); }'),

		// An object method is a function like any other, so it is not a module-load assertion
		withImport('const helpers = {check() { assert.ok(value); }};'),
		withImport('export const check = () => { assert.ok(value); };'),
		// A suite body is registration-time code, not a test body
		'import {describe, it} from \'node:test\';\nimport assert from \'node:assert\';\ndescribe(\'s\', () => { assert.ok(1); });',
		'import {describe, it} from \'node:test\';\nimport assert from \'node:assert\';\ndescribe(\'s\', () => { it(\'a\', () => { assert.ok(1); }); });',
	],
	invalid: [
		// A computed class field key is evaluated when the class is defined, which is at load
		withImport('class Config { [assert.ok(1)] = 1; }'),
		withImport('class Config { [String(assert.ok(1))] = 1; }'),
		{
			code: withImport('class Config { [(assert.ok(1) as any)] = 1; }'),
			languageOptions: {parser: parsers.typescript},
		},

		// Top-level assertion in a test file
		withImport('assert.ok(value);'),

		// Top-level inside a block (still no enclosing function)
		withImport('if (condition) { assert.ok(value); }'),

		// Top-level inside a loop
		withImport('for (const item of items) { assert.strictEqual(item, 1); }'),

		// Bare assert call
		withImport('assert(value);'),

		// Named import
		'import test from \'node:test\';\nimport {ok} from \'node:assert\';\nok(value);',

		// The strict view of the namespace, imported under a local name
		'import test from \'node:test\';\nimport {strict as nodeAssert} from \'node:assert\';\nnodeAssert.equal(a, b);',

		// Discarding the return value does not put the assertion inside a test
		withImport('void assert.ok(value);'),

		// Namespace import
		'import * as nodeTest from \'node:test\';\nimport * as assert from \'node:assert\';\nassert.ok(value);',

		// TypeScript
		{
			code: withImport('assert.ok(value as boolean);'),
			languageOptions: {parser: parsers.typescript},
		},

		// Optional-chained imported assert is still a standalone assertion
		withImport('assert?.ok(value);'),

		// A static field or static block does run when the module is loaded
		withImport('class C { static field = assert.ok(value); }'),
		withImport('class C { static { assert.ok(value); } }'),
	],
});

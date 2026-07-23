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
	],
	invalid: [
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

		// Namespace import
		'import * as nodeTest from \'node:test\';\nimport * as assert from \'node:assert\';\nassert.ok(value);',

		// TypeScript
		{
			code: withImport('assert.ok(value as boolean);'),
			languageOptions: {parser: parsers.typescript},
		},

		// Optional-chained imported assert is still a standalone assertion
		withImport('assert?.ok(value);'),
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import assert from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert file
		'strictEqual(x, x);',

		// Different operands
		withImport('assert.strictEqual(actual, expected);'),
		withImport('assert.deepStrictEqual(a, b);'),

		// Single-operand assertion
		withImport('assert.ok(x);'),
		withImport('assert(x);'),

		// Calls are not treated as the same reference (determinism check)
		withImport('assert.strictEqual(getValue(), getValue());'),
		withImport('assert.deepStrictEqual(a.read(), a.read());'),

		// Different members of the same object
		withImport('assert.strictEqual(obj.a, obj.b);'),

		// `.assert.*` on a non-context object — not a test context
		'import test from \'node:test\';\ntest(\'t\', () => { const db = makeDb(); db.assert.equal(x, x); });',
	],
	invalid: [
		// Identical identifiers — always passes
		withImport('assert.strictEqual(x, x);'),
		withImport('assert.equal(x, x);'),
		withImport('assert.deepStrictEqual(value, value);'),

		// Identical member expressions
		withImport('assert.strictEqual(obj.a, obj.a);'),

		// Negated — always fails
		withImport('assert.notStrictEqual(x, x);'),
		withImport('assert.notDeepEqual(obj.a, obj.a);'),

		// With a message argument
		withImport('assert.strictEqual(x, x, "should match");'),

		// Named import
		'import {strictEqual} from \'node:assert\';\nstrictEqual(x, x);',

		// Test context assertion
		'import test from \'node:test\';\ntest("x", t => { t.assert.strictEqual(value, value); });',

		// Parenthesized operand
		withImport('assert.strictEqual((x), x);'),

		// Namespace import
		'import * as assert from \'node:assert\';\nassert.strictEqual(x, x);',

		// TypeScript — wrappers stripped before comparison
		{
			code: withImport('assert.strictEqual(x as Foo, x);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import — ignored
		'assert.strictEqual(a, {});',

		// Neither arg is an object/array literal — valid
		withAssert('assert.strictEqual(a, b);'),
		withAssert('assert.strictEqual(a, 1);'),
		withAssert('assert.strictEqual(a, "str");'),

		// Already using the deep variant — correct usage
		withAssert('assert.deepStrictEqual(a, {});'),
		withAssert('assert.deepEqual(a, [1, 2]);'),

		// Other methods — not targeted by this rule
		withAssert('assert.ok(value);'),
		withAssert('assert.throws(fn, {message: "x"});'),

		// Identifier referencing an object — cannot be detected statically
		withAssert('assert.strictEqual(a, expected);'),

		// Function call returning an object — not a literal
		withAssert('assert.strictEqual(a, factory());'),

		// `new` expression — intentionally ignored (kept simple, narrow to literals)
		withAssert('assert.strictEqual(a, new Map());'),

		// Regex literal — intentionally ignored
		withAssert('assert.strictEqual(a, /re/);'),

		// Missing args — nothing to compare
		withAssert('assert.strictEqual(a);'),

		// `.assert.*` on a non-context object — not a test context, so not rewritten
		'import test from \'node:test\';\ntest(\'t\', () => { const db = makeDb(); db.assert.strictEqual(a, {}); });',
	],
	invalid: [
		// Object literal as expected
		withAssert('assert.strictEqual(a, {});'),
		withAssert('assert.strictEqual(a, {x: 1});'),

		// Object literal as actual
		withAssert('assert.strictEqual({a: 1}, b);'),

		// Array literal
		withAssert('assert.strictEqual(a, [1, 2]);'),
		withAssert('assert.strictEqual([1], b);'),

		// `equal` becomes `deepEqual`
		withAssert('assert.equal(a, {});'),

		// `notEqual` becomes `notDeepEqual`
		withAssert('assert.notEqual(a, []);'),

		// `notStrictEqual` becomes `notDeepStrictEqual`
		withAssert('assert.notStrictEqual(a, {x: 1});'),

		// Both args are literals
		withAssert('assert.strictEqual({}, {});'),

		// With message argument — still reported
		withAssert('assert.strictEqual(a, {}, "message");'),

		// Node:assert/strict
		withStrictAssert('assert.strictEqual(a, {});'),

		// T.assert
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.strictEqual(a, {}); });',
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.notStrictEqual([1], b); });',

		// Named import — reported but not fixed (cannot rename without importing the deep method)
		withNamedImport('strictEqual', 'strictEqual(a, {});'),
		withNamedImport('equal as eq', 'eq(a, [1]);'),

		// TypeScript — object literal wrapped in `as const`
		{
			code: withAssert('assert.strictEqual(a, {x: 1} as const);'),
			languageOptions: {parser: parsers.typescript},
		},
		// TypeScript — array literal wrapped in a type assertion
		{
			code: withAssert('assert.strictEqual(a, [1, 2] as number[]);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

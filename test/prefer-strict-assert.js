import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;
const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import — ignored
		'assert.equal(a, b);',

		// Already strict
		withAssert('assert.strictEqual(a, b);'),
		withAssert('assert.notStrictEqual(a, b);'),
		withAssert('assert.deepStrictEqual(a, b);'),
		withAssert('assert.notDeepStrictEqual(a, b);'),

		// Strict-mode import — the loose methods are aliases of the strict ones
		withStrictAssert('assert.equal(a, b);'),
		withStrictAssert('assert.deepEqual(a, b);'),
		withStrictAssert('assert.notEqual(a, b);'),
		withStrictAssert('assert.notDeepEqual(a, b);'),

		// Strict-mode named import
		withNamedImport('equal', 'equal(a, b);').replace('node:assert', 'node:assert/strict'),

		// Strict-mode namespace import
		'import * as assert from \'node:assert/strict\';\nassert.equal(a, b);',

		// Non-equality methods — not targeted
		withAssert('assert.ok(value);'),
		withAssert('assert(value);'),
		withAssert('assert.match(string, /re/);'),

		// Computed member — not matched
		withAssert('assert["equal"](a, b);'),

		// `<receiver>.assert.equal` is only a context assertion when the receiver is a plain identifier;
		// deeper chains, calls, and `this` are unrelated objects that merely have an `assert` property
		withAssert('a.b.assert.equal(x, y);'),
		withAssert('foo().assert.equal(x, y);'),
		withAssert('this.assert.equal(x, y);'),

		// `.assert.*` on a non-context identifier — not a test context, so not rewritten
		'import test from \'node:test\';\ntest(\'t\', () => { const db = makeDb(); db.assert.equal(a, b); });',
	],
	invalid: [
		// Namespace import
		withAssert('assert.equal(a, b);'),
		withAssert('assert.notEqual(a, b);'),
		withAssert('assert.deepEqual(a, b);'),
		withAssert('assert.notDeepEqual(a, b);'),

		// With message argument — still reported
		withAssert('assert.equal(a, b, "message");'),

		// Named import
		withNamedImport('equal', 'equal(a, b);'),
		withNamedImport('deepEqual', 'deepEqual(a, b);'),

		// Renamed named import
		withNamedImport('equal as eq', 'eq(a, b);'),

		// T.assert is always loose mode
		withTest('test(\'t\', t => { t.assert.equal(a, b); });'),
		withTest('test(\'t\', t => { t.assert.deepEqual(a, b); });'),

		// Mixed: one strict binding, one loose binding in the same file
		'import assert from \'node:assert\';\nimport strict from \'node:assert/strict\';\nassert.equal(a, b);\nstrict.equal(c, d);',

		// TypeScript
		{
			code: withAssert('assert.equal(a as string, b);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import — ignored
		'assert.deepEqual(a, 1);',

		// Both args are non-primitive — valid
		withAssert('assert.deepEqual(obj, other);'),
		withAssert('assert.deepStrictEqual(arr, other);'),
		withAssert('assert.notDeepEqual(obj, other);'),
		withAssert('assert.notDeepStrictEqual(arr, other);'),

		// Other methods — not targeted by this rule
		withAssert('assert.strictEqual(a, 1);'),
		withAssert('assert.equal(a, "string");'),
		withAssert('assert.ok(value);'),

		// Missing args — no primitives to detect (handled by assertion-arguments)
		withAssert('assert.deepEqual(a);'),

		// T.assert with non-primitive args
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.deepEqual(obj, other); });',

		// Named import with non-primitive args
		withNamedImport('deepEqual', 'deepEqual(obj, other);'),

		// Regex literal — not a primitive
		withAssert('assert.deepEqual(a, /re/);'),
		withAssert('assert.deepStrictEqual(/re/, b);'),

		// `.assert.*` on a non-context object — not a test context, so not rewritten
		'import test from \'node:test\';\ntest(\'t\', () => { const db = makeDb(); db.assert.deepEqual(a, 1); });',
	],
	invalid: [
		// DeepEqual with primitive actual
		withAssert('assert.deepEqual(1, b);'),
		withAssert('assert.deepEqual("str", b);'),
		withAssert('assert.deepEqual(true, b);'),
		withAssert('assert.deepEqual(null, b);'),
		withAssert('assert.deepEqual(undefined, b);'),
		withAssert('assert.deepEqual(NaN, b);'),
		withAssert('assert.deepEqual(Infinity, b);'),
		withAssert('assert.deepEqual(-1, b);'),
		withAssert('assert.deepEqual(-Infinity, b);'),
		withAssert('assert.deepEqual(42n, b);'),

		// DeepEqual with primitive expected
		withAssert('assert.deepEqual(a, 1);'),
		withAssert('assert.deepEqual(a, "str");'),
		withAssert('assert.deepEqual(a, null);'),
		withAssert('assert.deepEqual(a, undefined);'),

		// Template literal (no expressions) — is a primitive
		withAssert('assert.deepEqual(a, `hello`);'),
		withAssert('assert.deepEqual(`hello`, b);'),

		// Template literal with interpolation — still always a string primitive
		// eslint-disable-next-line no-template-curly-in-string
		withAssert('assert.deepEqual(a, `hello ${name}`);'),

		// Void expression
		withAssert('assert.deepEqual(void 0, b);'),

		// DeepStrictEqual -> strictEqual
		withAssert('assert.deepStrictEqual(a, 1);'),
		withAssert('assert.deepStrictEqual(1, b);'),

		// NotDeepEqual -> notEqual
		withAssert('assert.notDeepEqual(a, 1);'),
		withAssert('assert.notDeepEqual(1, b);'),

		// NotDeepStrictEqual -> notStrictEqual
		withAssert('assert.notDeepStrictEqual(a, 1);'),
		withAssert('assert.notDeepStrictEqual(1, b);'),

		// Node:assert/strict
		withStrictAssert('assert.deepEqual(a, 1);'),
		withStrictAssert('assert.deepStrictEqual(a, 1);'),

		// T.assert
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.deepEqual(a, 1); });',
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.deepStrictEqual(1, b); });',
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.notDeepEqual(a, "str"); });',
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.notDeepStrictEqual(null, b); });',

		// Named imports — reported but not autofixed (the strict variant is not imported)
		withNamedImport('deepEqual', 'deepEqual(a, 1);'),
		withNamedImport('deepEqual', 'deepEqual(1, b);'),
		withNamedImport('deepStrictEqual', 'deepStrictEqual(a, "str");'),
		withNamedImport('notDeepEqual', 'notDeepEqual(a, null);'),
		withNamedImport('notDeepStrictEqual', 'notDeepStrictEqual(a, true);'),

		// Renamed named import
		withNamedImport('deepEqual as de', 'de(a, 1);'),

		// With message argument — still reported
		withAssert('assert.deepEqual(a, 1, "message");'),

		// TypeScript
		{
			code: withAssert('assert.deepEqual(a as string, 1);'),
			languageOptions: {parser: parsers.typescript},
		},
		// TypeScript — primitive wrapped in a cast on the expected side
		{
			code: withAssert('assert.deepEqual(a, 1 as number);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.deepStrictEqual(a, "x" satisfies string);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

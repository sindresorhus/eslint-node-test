import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;
const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import, ignored
		'assert.throws(fn, "message");',

		// No error matcher argument
		withAssert('assert.throws(fn);'),

		// Proper error matchers
		withAssert('assert.throws(fn, /pattern/);'),
		withAssert('assert.throws(fn, TypeError);'),
		withAssert('assert.throws(fn, {message: "boom"});'),
		withAssert('assert.throws(fn, error => error.code === "X");'),

		// String in the third position is the message, correct usage
		withAssert('assert.throws(fn, TypeError, "failure message");'),

		// Other assertions are unaffected
		withAssert('assert.strictEqual(a, "b");'),
		withAssert('assert.doesNotThrow(fn, "message");'),

		// `.assert.throws` on a non-context object — not a test context
		withAssert('const custom = {assert: {throws() {}}};\ncustom.assert.throws(fn, "Wrong value");'),
	],
	invalid: [
		// String literal matcher
		withAssert('assert.throws(fn, "Wrong value");'),
		withAssert('assert.strict.throws(fn, "Wrong value");'),
		withAssert('assert.rejects(asyncFn, "Wrong value");'),

		// Template literal
		withAssert('assert.throws(fn, `Wrong value`);'),
		// eslint-disable-next-line no-template-curly-in-string
		withAssert('assert.throws(fn, `Wrong ${value}`);'),

		// With a trailing message argument
		withAssert('assert.throws(fn, "Wrong value", "failure message");'),

		// Named import
		withNamedImport('throws', 'throws(fn, "Wrong value");'),
		withNamedImport('strict as strictAssert', 'strictAssert.throws(fn, "Wrong value");'),

		// T.assert
		withTest('test(\'t\', t => { t.assert.throws(fn, "Wrong value"); });'),

		// TypeScript
		{
			code: withAssert('assert.throws(fn, "Wrong value" as string);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import
		'assert.throws(fn);',

		// With an error matcher
		withAssert('assert.throws(fn, TypeError);'),
		withAssert('assert.throws(fn, /pattern/);'),
		withAssert('assert.throws(fn, {message: "boom"});'),
		withAssert('assert.rejects(asyncFn, MyError);'),

		// Spread could expand to a matcher
		withAssert('assert.throws(...args);'),

		// Zero arguments is handled by assertion-arguments, not here
		withAssert('assert.throws();'),

		// A matcher that may be `undefined` or `null` at runtime cannot be relied on
		withAssert('assert.throws(fn, maybeError);'),
		withAssert('assert.throws(fn, ...rest);'),
		withAssert('assert.throws(fn, "");'),
		// An empty object or a primitive is a runtime type error, not a missing matcher
		withAssert('assert.throws(fn, {});'),
		withAssert('assert.throws(fn, 42);'),

		// Other assertions
		withAssert('assert.ok(value);'),

		// `.assert.throws` on a non-context object — not a test context
		'import test from \'node:test\';\ntest(\'t\', () => { const db = makeDb(); db.assert.throws(fn); });',
	],
	invalid: [
		// No matcher
		withAssert('assert.throws(fn);'),
		withAssert('assert.strict.throws(fn);'),
		withAssert('assert.throws(() => compute());'),
		withAssert('assert.rejects(asyncFn);'),

		// Named import
		withNamedImport('throws', 'throws(fn);'),
		withNamedImport('strict as strictAssert', 'strictAssert.throws(fn);'),

		// T.assert
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.throws(fn); });',

		// An explicit `undefined` or `null` matcher matches any thrown value, exactly like no matcher
		withAssert('assert.throws(fn, undefined);'),
		withAssert('assert.throws(fn, null);'),
		withAssert('assert.rejects(asyncFn, undefined);'),
		withAssert('assert.rejects(asyncFn, null);'),
		withNamedImport('throws', 'throws(fn, undefined);'),
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.throws(fn, null); });',
		{
			code: withAssert('assert.throws(fn, undefined as unknown);'),
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript
		{
			code: withAssert('assert.throws(fn as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

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

		// Other assertions
		withAssert('assert.ok(value);'),
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

		// TypeScript
		{
			code: withAssert('assert.throws(fn as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

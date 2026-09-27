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
		withAssert('assert.throws(fn, error => error.code === \'X\');'),
		withAssert('assert.throws(fn, expectedError);'),
		// A string second argument is the failure message, which `no-assert-throws-string` reports
		withAssert('assert.throws(fn, \'Wrong value\');'),
		// A spread could expand to a matcher, so it is left alone
		withAssert('assert.throws(fn, ...args);'),
		withAssert('assert.throws(fn, /pattern/);'),
		withAssert('assert.throws(fn, {message: "boom"});'),
		withAssert('assert.rejects(asyncFn, MyError);'),

		// Spread could expand to a matcher
		withAssert('assert.throws(...args);'),

		// A member expression is some other object's property, not a primitive literal
		withAssert('assert.throws(fn, Number.NaN);'),

		// Zero arguments is handled by assertion-arguments, not here
		withAssert('assert.throws();'),

		// A matcher that may be `undefined` or `null` at runtime cannot be relied on
		withAssert('assert.throws(fn, maybeError);'),
		withAssert('assert.throws(fn, ...rest);'),
		withAssert('assert.throws(fn, "");'),

		// Other assertions
		withAssert('assert.ok(value);'),

		// `.assert.throws` on a non-context object — not a test context
		'import test from \'node:test\';\ntest(\'t\', () => { const db = makeDb(); db.assert.throws(fn); });',
		'// A real own key makes it a validation object, whatever its prototype says\nimport assert from \'node:assert\';\nassert.throws(f, {__proto__: null, message: 1});',
		'// A spread adds keys, so the object is not empty even when the spread is\nimport assert from \'node:assert\';\nconst expected = {code: \'ERR_X\'};\nassert.throws(f, {...expected});',
		'// A computed `__proto__` is an ordinary own key, unlike the plain form\nimport assert from \'node:assert\';\nassert.throws(f, {[\'__proto__\']: 1});',
		'// The shorthand form is an own key too, unlike `__proto__: value`\nimport assert from \'node:assert\';\nconst __proto__ = 1;\nassert.throws(f, {__proto__});',
		'// A method or an accessor named `__proto__` is an own key too, unlike `__proto__: value`\nimport assert from \'node:assert\';\nassert.throws(f, {__proto__() {}});',
		'import assert from \'node:assert\';\nassert.throws(f, {get __proto__() {}});',
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

		// A matcher `node:assert` rejects outright, whatever the error is
		withAssert('assert.throws(fn, 42);'),
		withAssert('assert.throws(fn, true);'),
		withAssert('assert.throws(fn, 0);'),
		withAssert('assert.throws(fn, 1n);'),
		withAssert('assert.throws(fn, {});'),
		withAssert('assert.throws(fn, []);'),
		withAssert('assert.rejects(asyncFn, 42);'),
		withAssert('assert.rejects(asyncFn, {});'),

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

		// A primitive is rejected whatever it is written as, and `void 0` is `undefined`
		withAssert('assert.throws(fn, -1);'),
		withAssert('assert.throws(fn, !0);'),
		withAssert('assert.throws(fn, NaN);'),
		withAssert('assert.throws(fn, Infinity);'),
		withAssert('assert.throws(fn, void 0);'),
		withAssert('assert.throws(fn, void fn());'),
		withAssert('assert.rejects(asyncFn, !0);'),
		withNamedImport('throws', 'throws(fn, -1);'),
		'// A `__proto__` property sets the prototype rather than adding a key, so this object is empty\nimport assert from \'node:assert\';\nassert.throws(f, {__proto__: null});',
		'// A string key sets the prototype the same way the identifier does\nimport assert from \'node:assert\';\nassert.throws(f, {\'__proto__\': null});',
	],
});

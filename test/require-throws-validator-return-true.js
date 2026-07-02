import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withAssertNamespace = code => `import * as assert from 'node:assert/strict';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert/strict';\n${code}`;
const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import
		'assert.throws(fn, error => { assert.match(error.message, /bad/); });',

		// Non-function matchers
		withAssert('assert.throws(fn, TypeError);'),
		withAssert('assert.throws(fn, /bad/);'),
		withAssert('assert.throws(fn, {message: /bad/});'),

		// Referenced validator function
		withAssert('const validate = error => { assert.match(error.message, /bad/); };\nassert.throws(fn, validate);'),

		// Explicit `true`
		withAssert('assert.throws(fn, error => { assert.match(error.message, /bad/); return true; });'),
		withAssert('assert.rejects(fn, error => { assert.match(error.message, /bad/); return true; });'),
		withAssert('assert.throws(fn, error => { assert.match(error.message, /bad/); return true; }, "failure message");'),
		withAssert('assert.throws(fn, error => true);'),
		withAssert('assert.throws(fn, function (error) { return true; });'),
		withAssertNamespace('assert.throws(fn, error => { assert.match(error.message, /bad/); return true; });'),

		// Dynamic expressions may return `true`
		withAssert('assert.throws(fn, error => error instanceof TypeError);'),
		withAssert('assert.throws(fn, error => error.code === "ERR_BAD");'),
		withAssert('assert.throws(fn, error => { if (error.code === "ERR_BAD") { return true; } });'),

		// Named import
		withNamedImport('throws, match', 'throws(fn, error => { match(error.message, /bad/); return true; });'),

		// Test context assert
		withTest('test(\'t\', t => { t.assert.throws(fn, error => { t.assert.match(error.message, /bad/); return true; }); });'),

		// TypeScript
		{
			code: withAssert('assert.throws(fn, (error => { return true; }) as (error: Error) => boolean);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Missing return
		withAssert('assert.throws(fn, error => { assert.match(error.message, /bad/); });'),
		withAssert('assert.rejects(fn, error => { assert.match(error.message, /bad/); });'),

		// Empty return
		withAssert('assert.throws(fn, error => { assert.match(error.message, /bad/); return; });'),

		// Statically not `true`
		withAssert('assert.throws(fn, error => { assert.match(error.message, /bad/); return false; });'),
		withAssert('assert.throws(fn, error => { assert.match(error.message, /bad/); return 1; });'),
		withAssert('assert.throws(fn, error => { assert.match(error.message, /bad/); return {}; });'),
		withAssert('assert.throws(fn, error => { assert.match(error.message, /bad/); return new Boolean(true); });'),
		withAssert('assert.throws(fn, error => false);'),
		withAssert('assert.throws(fn, error => 1);'),
		withAssert('assert.throws(fn, error => ({}));'),

		// Assertion calls return `undefined`
		withAssert('assert.throws(fn, error => assert.match(error.message, /bad/));'),
		withAssert('assert.throws(fn, error => { return assert.match(error.message, /bad/); });'),

		// Async validators return a Promise, not `true`
		withAssert('assert.throws(fn, async error => true);'),
		withAssert('assert.throws(fn, async error => { return true; });'),
		withAssert('assert.throws(fn, error => Promise.resolve(true));'),
		withAssert('assert.throws(fn, error => { return Promise.resolve(true); });'),
		withAssert('assert.throws(fn, error => Promise.all([true]));'),

		// Generator validators return a generator object, not `true`
		withAssert('assert.throws(fn, function * (error) { return true; });'),
		withAssert('assert.throws(fn, function * (error) { yield true; });'),

		// Nested functions do not make the validator return `true`
		withAssert('assert.throws(fn, error => { const validate = () => true; validate(error); });'),

		// Named import
		withNamedImport('rejects, match', 'rejects(fn, error => { match(error.message, /bad/); });'),

		// Test context assert
		withTest('test(\'t\', t => { t.assert.rejects(fn, error => { t.assert.match(error.message, /bad/); }); });'),

		// TypeScript
		{
			code: withAssert('assert.throws(fn, (error => { assert.match(error.message, /bad/); }) as (error: Error) => boolean);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;
const withNamedStrictImport = (methods, code) => `import {${methods}} from 'node:assert/strict';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import
		'assert.ok(true);',

		// Dynamic assertions
		withAssert('assert.ok(result);'),
		withAssert('assert(result);'),
		withAssert('assert.strictEqual(actual, expected);'),
		withAssert('assert.deepStrictEqual(actual, {a: 1});'),
		withAssert('assert.match(value, /ell/);'),
		withAssert('assert.match("hello", pattern);'),
		withAssert('assert.ifError(error);'),
		withAssert('const pattern = /ell/g;\npattern.test("hello");\nassert.match("hello", pattern);'),

		// Explicit unreachable marker
		withAssert('assert.fail();'),
		withAssert('assert.fail("unreachable");'),

		// Other assertion methods
		withAssert('assert.throws(fn);'),
		withAssert('assert.rejects(fn);'),

		// Missing and spread arguments are handled by other rules or are not statically known
		withAssert('assert.ok();'),
		withAssert('assert.strictEqual(actual);'),
		withAssert('assert.strictEqual(...values);'),
		withAssert('assert.ok(true, ...messages);'),
		withAssert('assert.strictEqual(1, 1, ...messages);'),
		withAssert('assert.match("hello", /ell/, ...messages);'),
		withAssert('assert.match("hello");'),

		// Not a test context assertion
		'import test from \'node:test\';\nconst custom = {assert: {strictEqual() {}}};\ncustom.assert.strictEqual(1, 1);',
		'import test from \'node:test\';\ntest(\'t\', t => { function inner(t) { t.assert.strictEqual(1, 1); } });',
		'import test from \'node:test\';\nconst t = {assert: {strictEqual() {}}};\ntest(t.assert.strictEqual(1, 1), t => {});',
		'import {test} from \'node:test\';\ntest.mock.fn(t => { t.assert.strictEqual(1, 1); });',
		'import test from \'node:test\';\ntest.mock.fn(t => { t.assert.strictEqual(1, 1); });',

		// Shadowed assert imports
		withAssert('function helper(assert) { assert.ok(true); }'),
		withAssert('function helper(assert) { assert(true); }'),
		withNamedImport('strictEqual', 'function helper(strictEqual) { strictEqual(1, 1); }'),
	],
	invalid: [
		// Truthiness assertions
		withAssert('assert.ok(true);'),
		withAssert('assert.ok(false);'),
		withAssert('assert(false);'),
		withAssert('assert.ok(1 === 1);'),
		withAssert('assert.ok(`value`);'),
		withAssert('const value = true;\nassert.ok(value);'),

		// IfError
		withAssert('assert.ifError(undefined);'),
		withAssert('assert.ifError(null);'),
		withAssert('assert.ifError(0);'),

		// Equality assertions
		withAssert('assert.strictEqual(1, 1);'),
		withAssert('assert.notStrictEqual(1, 1);'),
		withAssert('assert.equal(1, "1");'),
		withAssert('assert.notEqual(1, "1");'),
		withAssert('assert.deepStrictEqual({a: 1}, {a: 1});'),
		withAssert('assert.notDeepStrictEqual({a: 1}, {a: 1});'),
		withAssert('assert.deepEqual([1], [1]);'),
		withAssert('assert.notDeepEqual([1], [1]);'),

		// Match assertions
		withAssert('assert.match("hello", /ell/);'),
		withAssert('assert.doesNotMatch("hello", /ell/);'),

		// Import forms
		'import * as assert from \'node:assert\';\nassert.strictEqual(1, 1);',
		withNamedImport('strictEqual', 'strictEqual(1, 1);'),
		withNamedImport('strictEqual as same', 'same(1, 1);'),
		withStrictAssert('assert.equal(1, "1");'),
		withNamedStrictImport('equal', 'equal(1, "1");'),

		// Test context assertion
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.strictEqual(1, 1); });',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'t\', t => { t.assert.strictEqual(1, 1); });',
		'import test from \'node:test\';\ntest(\'outer\', t => { t.test(\'inner\', subtest => { t.assert.strictEqual(1, 1); }); });',
		'import test from \'node:test\';\ntest(\'outer\', t => { t.test(\'inner\', subtest => { subtest.assert.strictEqual(1, 1); }); });',
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.assert.strictEqual(1, 1); });',
		'import {beforeEach as setup} from \'node:test\';\nsetup(t => { t.assert.strictEqual(1, 1); });',
		'import test from \'node:test\';\ntest.beforeEach(t => { t.assert.strictEqual(1, 1); });',
		'import * as nodeTest from \'node:test\';\nnodeTest.beforeEach(t => { t.assert.strictEqual(1, 1); });',

		// TypeScript
		{
			code: withAssert('assert.ok(true as boolean);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.strictEqual(1 as const, 1);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.ok(("x" satisfies string));'),
			languageOptions: {parser: parsers.typescript},
		},

		// A TypeScript-wrapped test callee still tracks the context parameter
		{
			code: 'import test from \'node:test\';\n(test as any)(\'t\', t => { t.assert.ok(1); });',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

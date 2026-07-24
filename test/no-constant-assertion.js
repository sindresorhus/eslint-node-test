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
		withAssert('let value = 1;\nvalue = compute();\nassert.strictEqual(value, 1);'),

		// A value read through a reference can be mutated before the assertion
		withStrictAssert('const original = [\'red\'];\nconst copy = original.slice();\nmutate(copy);\nassert.deepEqual(copy, original);'),
		withAssert('const object = {a: 1};\nmutate(object);\nassert.strictEqual(object.a, 1);'),
		withAssert('const expected = [1];\nassert.deepEqual([1], expected);'),
		withAssert('const expected = {a: 1};\nassert.deepStrictEqual({a: 1}, expected);'),
		withAssert('const values = [1];\nassert.deepEqual([...values], [1]);'),
		withAssert('const values = {a: 1};\nassert.deepEqual({...values}, {a: 1});'),
		withAssert('assert.ok(Math.PI);'),
		withAssert('const pattern = /ell/;\nassert.match(\'hello\', pattern);'),
		withAssert('assert.ok([1].length);'),

		// Expressions the rule intentionally does not evaluate
		withAssert('assert.strictEqual(String(1), \'1\');'),
		withAssert('assert.ok(() => {});'),
		withAssert('assert.deepEqual({a() {}}, {a() {}});'),
		withAssert('assert.ok((0, true));'),

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

		// An unrelated receiver stays unrelated under a TypeScript wrapper
		{
			code: 'import test from \'node:test\';\ntest(\'t\', t => { (custom as any).assert.strictEqual(1, 1); });',
			languageOptions: {parser: parsers.typescript},
		},

		// A suite context has no `assert`, so `s.assert` is some other object
		'import {describe} from \'node:test\';\ndescribe(\'s\', s => { s.assert.strictEqual(1, 1); });',

		// The context parameter is out of scope once the test callback ends
		'import test from \'node:test\';\ntest(\'t\', t => {});\nfunction helper(t) { t.assert.strictEqual(1, 1); }',

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
		withAssert('const value = 0;\nassert.ok(!value);'),
		withAssert('assert.ok(!!true);'),
		withAssert('assert.ok(true ? 1 : 0);'),
		// eslint-disable-next-line no-template-curly-in-string
		withAssert('assert.ok(`value ${1}`);'),

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
		withAssert('assert.deepEqual([1, , 2], [1, , 2]);'),
		withAssert('const value = 1;\nassert.strictEqual(value, 1);'),
		withAssert('const value = 1;\nassert.deepEqual([value], [1]);'),
		withAssert('const key = \'a\';\nassert.deepEqual({[key]: 1}, {a: 1});'),
		// A `let` that is never reassigned is bound to a primitive just like a `const`
		withAssert('let value = 1;\nassert.strictEqual(value, 1);'),

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
		// The context is resolved by scope, so it is still tracked through an intermediate non-test callback
		'import test from \'node:test\';\ntest(\'t\', t => { [1].forEach(() => { t.assert.strictEqual(1, 1); }); });',
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

		// A default-valued context parameter is still a context parameter
		'import test from \'node:test\';\ntest(\'t\', (t = {}) => { t.assert.ok(1); });',

		// Hooks declared from a test context receive a context too
		'import test from \'node:test\';\ntest(\'t\', t => { t.beforeEach(u => { u.assert.ok(1); }); });',

		// A trailing options argument does not hide the hook callback
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.assert.ok(1); }, {timeout: 1});',

		// A modifier still leaves a tracked test context
		'import test from \'node:test\';\ntest.skip(\'t\', t => { t.assert.ok(1); });',

		// Optional chaining on the context receiver
		'import test from \'node:test\';\ntest(\'t\', t => { t?.assert.ok(1); });',
	],
});

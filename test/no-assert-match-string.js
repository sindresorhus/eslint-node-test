import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withNamespaceAssert = code => `import * as assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;
const withNamedTestImport = (methods, code) => `import {${methods}} from 'node:test';\n${code}`;
const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import, ignored
		'assert.match(value, "foo");',

		// Proper regexp arguments
		withAssert('assert.match(value, /foo/);'),
		withAssert('assert.doesNotMatch(value, /foo/);'),
		withAssert('assert.match(value, pattern);'),
		withAssert('assert.match(value, new RegExp("foo"));'),

		// Shadowed assert imports are ignored
		withAssert('function run(assert) { assert.match(value, "foo"); }'),
		withNamedImport('match', 'function run(match) { match(value, "foo"); }'),

		// Missing and spread arguments are covered by other rules or are not statically known
		withAssert('assert.match(value);'),
		withAssert('assert.match(value, ...pattern);'),

		// Other assertions are unaffected
		withAssert('assert.strictEqual(value, "foo");'),
		withAssert('assert.throws(fn, "foo");'),

		// Non-context `assert` properties are ignored
		withTest('const helper = {assert: {match() {}}};\nhelper.assert.match(value, "foo");'),
		withTest('const t = {assert: {match() {}}};\nt.assert.match(value, "foo");'),
		withTest('test("t", t => { function helper(t) { t.assert.match(value, "foo"); } });'),
	],
	invalid: [
		// String literal regexp argument
		withAssert('assert.match(value, "foo");'),
		withAssert('assert.doesNotMatch(value, "foo");'),

		// Template literals
		withAssert('assert.match(value, `foo`);'),
		// eslint-disable-next-line no-template-curly-in-string
		withAssert('assert.match(value, `foo ${bar}`);'),

		// With a trailing message argument
		withAssert('assert.match(value, "foo", "failure message");'),

		// Comments around the regexp argument
		withAssert('assert.match(value, /* pattern */ "foo");'),

		// Named import
		withNamedImport('match', 'match(value, "foo");'),
		withNamedImport('doesNotMatch', 'doesNotMatch(value, "foo");'),

		// Strict assert forms
		withAssert('assert.strict.match(value, "foo");'),
		withAssert('assert.strict.doesNotMatch(value, "foo");'),
		withAssert('assert.strict /* comment */ .match(value, "foo");'),
		withStrictAssert('assert.match(value, "foo");'),
		withNamespaceAssert('assert.match(value, "foo");'),
		withNamedImport('strict as strictAssert', 'strictAssert.match(value, "foo");'),

		// T.assert
		withTest('test("t", t => { t.assert.match(value, "foo"); });'),
		withNamedTestImport('beforeEach', 'beforeEach(t => { t.assert.match(value, "foo"); });'),
		withTest('test("outer", t => { t.test("inner", () => { t.assert.match(value, "foo"); }); });'),

		// TypeScript
		{
			code: withAssert('assert.match(value, "foo" as string);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.match(value, ("foo" satisfies string));'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.match(value, ("foo" as string)!);'),
			languageOptions: {parser: parsers.typescript},
		},

		// Invalid regexp pattern, reported without the `new RegExp()` suggestion
		withAssert('assert.match(value, "[");'),
	],
});

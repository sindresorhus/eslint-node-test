import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withAssertStrict = code => `import assert from 'node:assert/strict';\n${code}`;
const withLegacyAssert = code => `import assert from 'assert';\n${code}`;
const withLegacyAssertStrict = code => `import assert from 'assert/strict';\n${code}`;
const withAssertNamespace = code => `import * as assert from 'node:assert';\n${code}`;
const withNamedImport = code => `import {ok} from 'node:assert';\n${code}`;
const withRenamedImport = code => `import {ok as assertOk} from 'node:assert';\n${code}`;
const withTest = code => `import test from 'node:test';\n${code}`;
const withHook = code => `import {beforeEach} from 'node:test';\n${code}`;
const withTestNamespace = code => `import * as nodeTest from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import.
		'assert.ok(a && b);',

		// No compound assertion.
		withAssert('assert.ok(value);'),
		withAssert('assert(value);'),

		// Other logical operators and comparisons are handled elsewhere or left alone.
		withAssert('assert.ok(a || b);'),
		withAssert('assert.ok(a === b);'),
		withAssert('assert.strictEqual(a && b, true);'),

		// Missing/unknown argument shape.
		withAssert('assert.ok();'),
		withAssert('assert.ok(...values);'),

		// `*.assert` is only treated as the test context when the receiver is an active context name.
		withTest('helper.assert.ok(a && b);'),
		withTest('test(\'t\', t => {\n\thelper.assert.ok(a && b);\n});'),
		withTest('test(t.assert.ok(a && b), t => {});'),

		// Shadowed assertion bindings are unrelated.
		withAssert('function helper(assert) {\n\tassert.ok(a && b);\n}'),
		withNamedImport('function helper(ok) {\n\tok(a && b);\n}'),
		withTest('test(\'t\', t => {\n\tfunction helper(t) {\n\t\tt.assert.ok(a && b);\n\t}\n});'),
		withTest('function helper(test) {\n\ttest(\'t\', t => {\n\t\tt.assert.ok(a && b);\n\t});\n}'),
		withHook('function helper(beforeEach) {\n\tbeforeEach(t => {\n\t\tt.assert.ok(a && b);\n\t});\n}'),
	],
	invalid: [
		// Bare assert.
		withAssert('assert(a && b);'),

		// Assert.ok.
		withAssert('assert.ok(a && b);'),
		withAssertStrict('assert.ok(a && b);'),
		withLegacyAssert('assert.ok(a && b);'),
		withLegacyAssertStrict('assert.ok(a && b);'),
		withAssertNamespace('assert.ok(a && b);'),

		// Nested chains are split into one assertion per operand.
		withAssert('assert.ok(a && b && c);'),
		withAssert('assert.ok(a && (b && c));'),
		withAssert('assert.ok(a && (b, c));'),

		// Named import.
		withNamedImport('ok(a && b);'),
		withRenamedImport('assertOk(a && b);'),

		// T.assert.ok.
		withTest('test(\'t\', t => {\n\tt.assert.ok(a && b);\n});'),
		withTest('test(\'parent\', t => {\n\tt.test(\'child\', t => {\n\t\tt.assert.ok(a && b);\n\t});\n});'),
		withHook('beforeEach(t => {\n\tt.assert.ok(a && b);\n});'),
		withTestNamespace('nodeTest.beforeEach(t => {\n\tt.assert.ok(a && b);\n});'),

		// Custom message — reported without a fix.
		withAssert('assert.ok(a && b, "should match");'),

		// Comments — reported without a fix.
		withAssert('assert.ok(a && /* keep */ b);'),
		withAssert('assert.ok(/* keep */ a && b);'),
		withAssert('assert.ok(a && b) /* keep */;'),

		// Used return value — reported without a fix.
		withAssert('const result = assert.ok(a && b);'),
		withAssert('const fn = () => assert.ok(a && b);'),

		// Standalone, but not at the start of a line — reported without a fix.
		withTest('test(\'t\', t => { t.assert.ok(a && b); });'),

		// Standalone, but with a trailing comment — reported without a fix.
		withAssert('assert.ok(a && b); // keep'),

		// TypeScript.
		{
			code: withAssert('assert.ok((a as boolean) && b);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.ok((a && b) as boolean);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

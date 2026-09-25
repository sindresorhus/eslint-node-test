import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withAssertStrict = code => `import assert from 'node:assert/strict';\n${code}`;
const withLegacyAssert = code => `import assert from 'assert';\n${code}`;
const withLegacyAssertStrict = code => `import assert from 'assert/strict';\n${code}`;
const withAssertNamespace = code => `import * as assert from 'node:assert';\n${code}`;
const withNamedImport = code => `import {ok} from 'node:assert';\n${code}`;
const withRenamedImport = code => `import {ok as assertOk} from 'node:assert';\n${code}`;
const withStrictNamedImport = code => `import {strict as assert} from 'node:assert';\n${code}`;
const withStrictImport = code => `import {strict} from 'node:assert';\n${code}`;
const withTest = code => `import test from 'node:test';\n${code}`;
const withTestAndAssert = code => `import test from 'node:test';\nimport assert from 'node:assert';\n${code}`;
const withHook = code => `import {beforeEach} from 'node:test';\n${code}`;
const withTestNamespace = code => `import * as nodeTest from 'node:test';\n${code}`;
const withRenamedTest = code => `import {test as nodeTest} from 'node:test';\n${code}`;

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
		withTest('test.custom(\'t\', t => {\n\tt.assert.ok(a && b);\n});'),
		withTestNamespace('nodeTest.test.custom(\'t\', t => {\n\tt.assert.ok(a && b);\n});'),

		// Shadowed assertion bindings are unrelated.
		withAssert('function helper(assert) {\n\tassert.ok(a && b);\n}'),
		withNamedImport('function helper(ok) {\n\tok(a && b);\n}'),
		withTest('test(\'t\', t => {\n\tfunction helper(t) {\n\t\tt.assert.ok(a && b);\n\t}\n});'),
		withTest('function helper(test) {\n\ttest(\'t\', t => {\n\t\tt.assert.ok(a && b);\n\t});\n}'),
		withHook('function helper(beforeEach) {\n\tbeforeEach(t => {\n\t\tt.assert.ok(a && b);\n\t});\n}'),
		withHook('beforeEach.custom(t => {\n\tt.assert.ok(a && b);\n});'),

		// `TestContext#assert` has no `strict` view, so `assert.strict.ok(…)` is a `TypeError`
		// rather than a compound assertion
		withTest('test(\'t\', ({assert}) => { assert.strict.ok(a && b); });'),
		withTest('test(\'t\', ({assert}) => { assert.strict.equal(a, b); });'),
	],
	invalid: [
		withTest('test(\'t\', ({assert}) => { assert.ok(a && b); });'),
		// A class static block is a plain statement list, so the split applies there too
		'import test from \'node:test\';\nimport assert from \'node:assert\';\n\nclass A {\n\tstatic {\n\t\tassert.ok(x > 0 && x < 5);\n\t}\n}',
		'import {beforeEach} from \'node:test\';\nbeforeEach(({assert}) => { assert.ok(a && b); });',

		// A nested context's `t.plan()` does not apply to the outer one, which stays fixable
		withTest(`test('t', t => {
	t.test('s', t2 => {
		t2.plan(1);
	});
	t.assert.ok(a && b);
});`),

		// A `t.plan(n)` makes the assertion count significant, so splitting one assertion into
		// several would break the test. Still reported, but not fixed.
		withTest(`test('t', t => {
	t.plan(1);
	t.assert.ok(a && b);
});`),
		withTest(`test('t', t => {
	t.plan(2);
	t.assert.ok(a && b);
});`),
		withTest(`test('t', async t => {
	t.plan(1);
	t.assert.ok(await f() && g());
});`),
		withHook(`beforeEach(t => {
	t.plan(1);
	t.assert.ok(a && b);
});`),
		withTest(`test('t', t => {
	t.plan(1);
	t.test('s', t2 => {
		t2.assert.ok(c && d);
	});
});`),

		// Bare assert.
		withAssert('assert(a && b);'),

		// Assert.ok.
		withAssert('assert.ok(a && b);'),
		withAssertStrict('assert.ok(a && b);'),
		withLegacyAssert('assert.ok(a && b);'),
		withLegacyAssertStrict('assert.ok(a && b);'),
		withAssertNamespace('assert.ok(a && b);'),
		withStrictNamedImport('assert.ok(a && b);'),
		withStrictImport('strict.ok(a && b);'),

		// Nested chains are split into one assertion per operand.
		withAssert('assert.ok(a && b && c);'),
		withAssert('assert.ok(a && (b && c));'),
		withAssert('assert.ok(a && (b, c));'),

		// Named import.
		withNamedImport('ok(a && b);'),
		withRenamedImport('assertOk(a && b);'),

		// T.assert.ok.
		withTest('test(\'t\', t => {\n\tt.assert.ok(a && b);\n});'),
		withTest('test.only(\'t\', t => {\n\tt.assert.ok(a && b);\n});'),
		withTestNamespace('nodeTest.test(\'t\', t => {\n\tt.assert.ok(a && b);\n});'),
		withRenamedTest('nodeTest(\'t\', context => {\n\tcontext.assert.ok(a && b);\n});'),
		withTest('test(\'parent\', t => {\n\tt.test(\'child\', t => {\n\t\tt.assert.ok(a && b);\n\t});\n});'),
		withTest('test(\'parent\', t => {\n\tt.test(\'child\', subtest => {\n\t\tt.assert.ok(a && b);\n\t});\n});'),
		withTest('test.beforeEach(t => {\n\tt.assert.ok(a && b);\n});'),
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

		// Braceless control-flow body — reported without a fix.
		withAssert('if (enabled)\n\tassert.ok(a && b);'),

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
		// A TypeScript wrapper on the callee — the fix keeps the call's own parentheses, which
		// `assert.ok as any(x)` would need to parse.
		{
			code: withTestAndAssert('test(\'t\', () => {\n\t(assert.ok as any)(a && b);\n});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withTestAndAssert('test(\'t\', () => {\n\t(assert.ok satisfies any)(a && b);\n});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withTestAndAssert('test(\'t\', () => {\n\tassert.ok!(a && b);\n});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withTestAndAssert('test(\'t\', () => {\n\t(assert.ok)(a && b);\n});'),
			languageOptions: {parser: parsers.typescript},
		},

		// A computed or optional `plan` member is the same call, and fixing it would break the test
		withTest(`test('t', t => {
	t['plan'](1);
	t.assert.ok(a && b);
});`),
		withTest(`test('t', t => {
	t[\`plan\`](1);
	t.assert.ok(a && b);
});`),
		withTest(`test('t', t => {
	t.plan?.(1);
	t.assert.ok(a && b);
});`),

		// The `plan` option sets the same expected count as `t.plan(n)`, so the fix stands down for it too
		withTest(`test('t', {plan: 1}, t => {
	t.assert.ok(a && b);
});`),
		withTest(`test('t', async t => {
	await t.test('s', {plan: 1}, s => {
		s.assert.ok(a && b);
	});
});`),
		// A plan count that is not a real plan sets no expectation, so the fix is still safe
		withTest(`test('t', {plan: 0}, t => {
	t.assert.ok(a && b);
});`),

		// A plan declared on a nested test belongs to that test, not to the one it sits inside
		// A plan declared on a nested test belongs to that test, not to the one it sits inside
		withAssert(`test('o', t => {
	t.test('i', {plan: 1}, () => {});
	assert.ok(a && b);
});`),
		withAssert(`test('o', t => {
	test('i', {plan: 1});
	assert.ok(a && b);
});`),
		// A `getTestContext()` plan is the same plan as `t.plan(n)`
		'import {test, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\n'
		+ 'test(\'a\', () => {\n\tgetTestContext().plan(1);\n\tassert.ok(a && b);\n});',
	],
});

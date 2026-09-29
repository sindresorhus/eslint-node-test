import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// A `var` that re-binds the context parameter resolves to the same variable, so the name no
		// longer reaches the test context
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'t\', t => { var t = other; assert.ok(1); });',
		// Not a test file
		'import assert from \'node:assert\';\nassert.ok(x);',

		// Already using the test context
		'import test from \'node:test\';\ntest(\'x\', t => { t.assert.ok(value); });',

		// No assert imported
		'import test from \'node:test\';\ntest(\'x\', t => { ok(value); });',

		// Context callback has no parameter — nothing to convert to
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', () => { assert.ok(value); });',

		// Assertion outside any test (top-level)
		'import test from \'node:test\';\nimport assert from \'node:assert\';\nassert.ok(value);',

		// Assertion in a hook (no test context in scope)
		'import test, {beforeEach} from \'node:test\';\nimport assert from \'node:assert\';\nbeforeEach(() => { assert.ok(value); });',

		// Assertion in a hook whose callback has a context parameter — still left alone (hooks are excluded)
		'import test, {beforeEach} from \'node:test\';\nimport assert from \'node:assert\';\nbeforeEach(t => { assert.ok(value); });',

		// Inner subtest without a context parameter — outer `t` would assert against the wrong test
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { t.test(\'y\', () => { assert.ok(value); }); });',
		// A local binding shadows an aliased `getTestContext` import, so `gtc().assert` would not be
		// the test context
		'import test, {getTestContext as gtc} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', () => { const gtc = {}; assert.ok(value); });',

		// Shadowed import name
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { function helper(assert) { assert.ok(value); } helper(localAssert); });',

		// Assertion in test arguments where the context parameter is not in scope
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(assert.ok(value), t => {});',

		// Context parameter name is shadowed at the assertion site
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { { const t = custom; assert.ok(value); } });',

		// Unrelated `assert` property
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { custom.assert.ok(value); });',
		// A test body named out of line with no context parameter, in a file that does not import `getTestContext`, has nothing to convert to
		'import test from \'node:test\';\nimport assert from \'node:assert\';\nfunction body() {\n\tassert.ok(value);\n}\ntest(\'x\', body);',
		// A helper the test calls, and a hook body named out of line, are not test bodies
		'import test from \'node:test\';\nimport assert from \'node:assert\';\nfunction helper(t) {\n\tassert.ok(value);\n}\ntest(\'x\', t => helper(t));',
		'import test from \'node:test\';\nimport assert from \'node:assert\';\nfunction hook(t) {\n\tassert.ok(value);\n}\ntest.beforeEach(hook);',
		// A `var` that re-binds the parameter of a body named out of line no longer reaches the context
		'import test from \'node:test\';\nimport assert from \'node:assert\';\nfunction body(t) {\n\tvar t = other;\n\tassert.ok(value);\n}\ntest(\'x\', body);',
	],
	invalid: [
		// A test body named out of line is read like an inline one
		'import test from \'node:test\';\nimport assert from \'node:assert\';\nfunction body(t) {\n\tassert.ok(value);\n}\ntest(\'x\', body);',
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', body);\nconst body = t => {\n\tassert.strictEqual(a, b);\n};',
		'import {test, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\nfunction body() {\n\tassert.ok(value);\n}\ntest(\'x\', body);',
		// A subtest body named out of line has its own context, not the context of the test it is declared in
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => {\n\tfunction body(s) {\n\t\tassert.ok(value);\n\t}\n\tt.test(\'y\', body);\n});',
		// An inline test inside a body named out of line has its own context
		'import test from \'node:test\';\nimport assert from \'node:assert\';\nfunction body(t) {\n\tt.test(\'y\', s => {\n\t\tassert.ok(value);\n\t});\n}\ntest(\'x\', body);',
		// Namespace member
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { assert.strictEqual(a, b); });',

		// Bare assert call (alias of `ok`)
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { assert(value); });',

		// Named import
		'import test from \'node:test\';\nimport {strictEqual} from \'node:assert\';\ntest(\'x\', t => { strictEqual(a, b); });',

		// Renamed named import
		'import test from \'node:test\';\nimport {deepStrictEqual as deep} from \'node:assert\';\ntest(\'x\', t => { deep(a, b); });',

		// Strict import with a loose method — suggestion remaps to the strict method
		'import test from \'node:test\';\nimport assert from \'node:assert/strict\';\ntest(\'x\', t => { assert.equal(a, b); });',

		// Strict named import with a loose method
		'import test from \'node:test\';\nimport {deepEqual} from \'node:assert/strict\';\ntest(\'x\', t => { deepEqual(a, b); });',

		// Strict namespace forms with loose methods
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { assert.strict.equal(a, b); });',
		'import test from \'node:test\';\nimport {strict as strictAssert} from \'node:assert\';\ntest(\'x\', t => { strictAssert.equal(a, b); });',

		// Strict namespace callable form
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { assert.strict(value); });',
		'import test from \'node:test\';\nimport {strict as strictAssert} from \'node:assert\';\ntest(\'x\', t => { strictAssert(value); });',

		// Non-strict loose method stays loose
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { assert.deepEqual(a, b); });',

		// Renamed context parameter
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', context => { assert.ok(value); });',

		// Subtest with its own context parameter
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { t.test(\'y\', t2 => { assert.ok(value); }); });',

		// `it` alias
		'import {it} from \'node:test\';\nimport assert from \'node:assert\';\nit(\'x\', t => { assert.ok(value); });',

		// Namespace import of node:test
		'import * as nodeTest from \'node:test\';\nimport assert from \'node:assert\';\nnodeTest.test(\'x\', t => { assert.ok(value); });',

		// Namespace import of node:assert
		'import test from \'node:test\';\nimport * as assert from \'node:assert\';\ntest(\'x\', t => { assert.deepStrictEqual(a, b); });',

		// Comment inside the callee — reported without a suggestion
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { assert./* keep */ok(value); });',

		// TypeScript
		{
			code: 'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', (t: TestContext) => { assert.ok(value); });',
			languageOptions: {parser: parsers.typescript},
		},

		// Defaulted context parameter.
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', (t = undefined) => { assert.ok(value); });',
		// A TypeScript-wrapped assert callee is still the imported assert.
		{
			code: 'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'a\', t => { assert!.ok(1); });',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'a\', t => { (assert as any).ok(1); });',
			languageOptions: {parser: parsers.typescript},
		},

		// A `getTestContext` import under any local alias is the same import, and the suggestion
		// has to name the local one
		'import test, {getTestContext as gtc} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', () => { assert.ok(value); });',
		'import test, {getTestContext as gtc} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { assert.ok(value); });',
		{
			code: '// A cast on the module reads the same as the bare form\n'
				+ 'import test from \'node:test\';\n'
				+ 'import assert from \'node:assert\';\n'
				+ 'test(\'a\', t => {\n'
				+ '\tassert!.strict.equal(x, 1);\n'
				+ '});',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

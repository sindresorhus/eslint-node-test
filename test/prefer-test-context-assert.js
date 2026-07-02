import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
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

		// Inner subtest without a context parameter — outer `t` would assert against the wrong test
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { t.test(\'y\', () => { assert.ok(value); }); });',

		// `assert.strict.equal` namespace form is intentionally not matched
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'x\', t => { assert.strict.equal(a, b); });',
	],
	invalid: [
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
	],
});

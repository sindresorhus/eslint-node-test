import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const ASSERT_IMPORT = 'import assert from \'node:assert\';';
const STRICT_ASSERT_IMPORT = 'import assert from \'node:assert/strict\';';
const STRICT_NAMED_IMPORT = 'import {strict as strictAssert} from \'node:assert\';';
const NAMED_IMPORT = 'import {rejects, doesNotReject} from \'node:assert\';';

test.snapshot({
	valid: [
		// Not an assert file
		'assert.rejects(fn);',
		'assert.doesNotReject(fn);',

		// Properly awaited
		`${ASSERT_IMPORT}\nawait assert.rejects(fn);`,
		`${ASSERT_IMPORT}\nawait assert.doesNotReject(fn);`,

		// Returned (valid in async context)
		`${ASSERT_IMPORT}\nasync function test() { return assert.rejects(fn); }`,
		`${ASSERT_IMPORT}\nasync function test() { return assert.doesNotReject(fn); }`,

		// Assigned to a variable
		`${ASSERT_IMPORT}\nasync function test() { const p = assert.rejects(fn); await p; }`,

		// Chained
		`${ASSERT_IMPORT}\nasync function test() { await assert.rejects(fn).catch(() => {}); }`,

		// Other assert methods — not rejects/doesNotReject
		`${ASSERT_IMPORT}\nassert.ok(true);`,
		`${ASSERT_IMPORT}\nassert.strictEqual(1, 1);`,
		`${ASSERT_IMPORT}\nassert.throws(() => fn());`,

		// Named import but properly awaited
		`${NAMED_IMPORT}\nasync function test() { await rejects(fn); }`,

		// `t.assert.rejects` properly awaited in a test file (no `node:assert` import)
		'import test from \'node:test\';\ntest(\'t\', async t => {\n\tawait t.assert.rejects(fn);\n});',
	],
	invalid: [
		// Bare assert.rejects in async function — autofix available
		`${ASSERT_IMPORT}\nasync function test() {\n\tassert.rejects(fn);\n}`,

		// Bare assert.doesNotReject in async function — autofix available
		`${ASSERT_IMPORT}\nasync function test() {\n\tassert.doesNotReject(fn);\n}`,

		// Bare assert.rejects at top-level (not in async function) — suggestion only
		`${ASSERT_IMPORT}\nassert.rejects(fn);`,
		`${ASSERT_IMPORT}\nassert.strict.rejects(fn);`,

		// Bare assert.doesNotReject at top-level — suggestion only
		`${ASSERT_IMPORT}\nassert.doesNotReject(fn);`,

		// Inside a non-async function — suggestion only
		`${ASSERT_IMPORT}\nfunction test() {\n\tassert.rejects(fn);\n}`,

		// Bare named import
		`${NAMED_IMPORT}\nasync function test() {\n\trejects(fn);\n}`,
		`${NAMED_IMPORT}\nasync function test() {\n\tdoesNotReject(fn);\n}`,

		// T.assert.rejects form
		'import test from \'node:test\';\nimport assert from \'node:assert\';\nasync function run() {\n\tt.assert.rejects(fn);\n}',

		// `t.assert.rejects` in a test file WITHOUT a `node:assert` import — caught via the test-file activation
		'import test from \'node:test\';\ntest(\'t\', async t => {\n\tt.assert.rejects(fn);\n});',

		// Assert/strict module
		`${STRICT_ASSERT_IMPORT}\nasync function test() {\n\tassert.rejects(fn);\n}`,
		`${STRICT_NAMED_IMPORT}\nasync function test() {\n\tstrictAssert.rejects(fn);\n}`,

		// TypeScript
		{
			code: `${ASSERT_IMPORT}\nasync function test() {\n\tassert.rejects(fn as () => Promise<void>);\n}`,
			languageOptions: {parser: parsers.typescript},
		},

		// Arrow function
		`${ASSERT_IMPORT}\nconst run = async () => {\n\tassert.rejects(fn);\n};`,
	],
});

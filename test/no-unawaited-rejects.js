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

		// Optional-chained but properly awaited
		`${ASSERT_IMPORT}\nasync function test() { await assert?.rejects(fn); }`,

		// `.assert.rejects` on a non-context object — not a test context, so not this rule's concern
		'import test from \'node:test\';\nimport assert from \'node:assert\';\nasync function run() {\n\tdb.assert.rejects(fn);\n}',

		// `void` does not override the context filter — a non-context receiver is still ignored
		'import test from \'node:test\';\nimport assert from \'node:assert\';\nasync function run() {\n\tvoid db.assert.rejects(fn);\n}',
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

		// `t.assert.rejects` form (with a `node:assert` import also present)
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'t\', async t => {\n\tt.assert.rejects(fn);\n});',

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

		// Explicitly discarded with `void` — still floating, reported without an autofix
		`${ASSERT_IMPORT}\nvoid assert.rejects(fn);`,
		`${ASSERT_IMPORT}\nasync function test() {\n\tvoid assert.rejects(fn);\n}`,
		`${ASSERT_IMPORT}\nasync function test() {\n\tvoid assert.doesNotReject(fn);\n}`,

		// Voided context assertion in a test file (no `node:assert` import)
		'import test from \'node:test\';\ntest(\'t\', async t => {\n\tvoid t.assert.rejects(fn);\n});',

		// Optional-chained floating call — the `ChainExpression` wrapper must not hide it
		`${ASSERT_IMPORT}\nasync function test() {\n\tassert?.rejects(fn);\n}`,
		`${ASSERT_IMPORT}\nassert?.rejects(fn);`,
		`${ASSERT_IMPORT}\nvoid assert?.rejects(fn);`,

		// Optional-chained context assertion — `ChainExpression` unwrap plus context receiver together
		'import test from \'node:test\';\ntest(\'t\', async t => {\n\tt?.assert.rejects(fn);\n});',

		// TypeScript wrappers around the floating call must not hide it (matches the callee-side
		// handling, where `(assert as any).rejects(fn)` is already caught). Reported without a fix:
		// `as` binds looser than `await`, so `await assert.rejects(fn) as Promise<void>` would cast
		// the awaited value instead of the Promise.
		{
			code: `${ASSERT_IMPORT}\nasync function test() {\n\tassert.rejects(fn) as Promise<void>;\n}`,
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: `${ASSERT_IMPORT}\nassert.rejects(fn)!;`,
			languageOptions: {parser: parsers.typescript},
		},

		// `void` wrapping a TypeScript-cast call — both wrappers must be unwrapped together
		{
			code: `${ASSERT_IMPORT}\nvoid (assert.rejects(fn) as any);`,
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: `${ASSERT_IMPORT}\nasync function test() {\n\tvoid (assert.rejects(fn) as any);\n}`,
			languageOptions: {parser: parsers.typescript},
		},

		// A TypeScript wrapper *around* the `void` expression must not hide it either
		{
			code: `${ASSERT_IMPORT}\nasync function test() {\n\t(void assert.rejects(fn)) as any;\n}`,
			languageOptions: {parser: parsers.typescript},
		},
	],
});

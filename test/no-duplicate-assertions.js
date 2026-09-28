import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const head = 'import test from \'node:test\';\nimport assert from \'node:assert\';\n';
const withTest = code => `${head}test('user', () => {\n${code}\n});`;
const withAsyncTest = code => `${head}test('user', async () => {\n${code}\n});`;
const withStrictAndLooseAssert = code => [
	'import test from \'node:test\';',
	'import strictAssert from \'node:assert/strict\';',
	'import looseAssert from \'node:assert\';',
	'test(\'user\', () => {',
	code,
	'});',
].join('\n');
const withContextTest = code => 'import test from \'node:test\';\ntest(\'user\', t => {\n' + code + '\n});';
const withNamedAssertImport = code => [
	'import test from \'node:test\';',
	'import {strictEqual} from \'node:assert\';',
	'test(\'user\', () => {',
	code,
	'});',
].join('\n');
const withShadowedTestParameter = code => [
	head + 'function helper(test) {',
	code,
	'}',
	'helper(localTest);',
].join('\n');
const withDescribe = code => [
	'import {describe, beforeEach} from \'node:test\';',
	'import assert from \'node:assert\';',
	'describe(\'group\', () => {',
	code,
	'});',
].join('\n');

test.snapshot({
	valid: [
		// Not an assert or test file
		'assert.strictEqual(user.id, 1);\nassert.strictEqual(user.id, 1);',

		// Assertions outside tests are ignored
		'import assert from \'node:assert\';\nassert.strictEqual(user.id, 1);\nassert.strictEqual(user.id, 1);',

		// Duplicate assertions separated by another statement can intentionally check stability
		withTest('\tassert.strictEqual(user.id, 1);\n\tmutate(user);\n\tassert.strictEqual(user.id, 1);'),
		withTest('\tassert.strictEqual(user.id, 1);\n\tconst marker = true;\n\tassert.strictEqual(user.id, 1);'),
		withTest('\tassert.strictEqual(user.id, 1);\n\tif (ready) {\n\t\tassert.ok(ready);\n\t}\n\tassert.strictEqual(user.id, 1);'),

		// A statement that is not an assertion expression breaks the run, whatever its shape
		withAsyncTest('\tassert.strictEqual(user.id, 1);\n\tawait cleanup();\n\tassert.strictEqual(user.id, 1);'),
		withTest('\tassert.strictEqual(user.id, 1);\n\tcounter++;\n\tassert.strictEqual(user.id, 1);'),
		{
			code: withTest('\tassert.strictEqual(user.id, 1);\n\tuser!.id;\n\tassert.strictEqual(user.id, 1);'),
			languageOptions: {parser: parsers.typescript},
		},

		// Only the test body's own statement list is checked, not a nested block's
		withTest('\tfor (const user of users) {\n\t\tassert.strictEqual(user.id, 1);\n\t\tassert.strictEqual(user.id, 1);\n\t}'),

		// Different assertions
		withTest('\tassert.strictEqual(user.id, 1);\n\tassert.strictEqual(user.name, \'Ada\');'),
		withTest('\tassert.strictEqual(user.id, 1);\n\tassert.equal(user.id, 1);'),
		withTest('\tassert.strictEqual((user.id, user.name), \'Ada\');\n\tassert.strictEqual(user.id, user.name, \'Ada\');'),

		// Same assertion in sibling tests
		`${head}test('a', () => {\n\tassert.strictEqual(user.id, 1);\n});\ntest('b', () => {\n\tassert.strictEqual(user.id, 1);\n});`,

		// Nested tests are tracked independently
		`${head}test('parent', t => {\n\tassert.strictEqual(user.id, 1);\n\tt.test('child', () => {\n\t\tassert.strictEqual(user.id, 1);\n\t});\n});`,
		`${head}test('parent', t => {\n\tassert.strictEqual(user.id, 1);\n\tt.test('child', () => {});\n\tassert.strictEqual(user.id, 1);\n});`,

		// Assertions in helper functions are ignored
		withTest('\tfunction helper() {\n\t\tassert.strictEqual(user.id, 1);\n\t\tassert.strictEqual(user.id, 1);\n\t}'),

		// Assertions in describe and hooks are ignored
		withDescribe('\tassert.strictEqual(user.id, 1);\n\tassert.strictEqual(user.id, 1);\n\tbeforeEach(() => {\n\t\tassert.strictEqual(user.id, 1);\n\t\tassert.strictEqual(user.id, 1);\n\t});'),

		// Non-context `assert` properties are ignored
		withContextTest('\tfake.assert.strictEqual(user.id, 1);\n\tfake.assert.strictEqual(user.id, 1);'),

		// A parameter that shadows the context name is a different variable
		withContextTest('\tfunction helper(t) {\n\t\tt.assert.strictEqual(user.id, 1);\n\t\tt.assert.strictEqual(user.id, 1);\n\t}'),

		// Computed properties are ignored
		withTest('\tassert[\'strictEqual\'](user.id, 1);\n\tassert[\'strictEqual\'](user.id, 1);'),

		// Shadowed imports are ignored
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'user\', assert => {\n\tassert.strictEqual(user.id, 1);\n\tassert.strictEqual(user.id, 1);\n});',
		withNamedAssertImport('\tconst strictEqual = localAssert;\n\tstrictEqual(user.id, 1);\n\tstrictEqual(user.id, 1);'),
		withShadowedTestParameter('\ttest(\'local\', () => {\n\t\tassert.strictEqual(user.id, 1);\n\t\tassert.strictEqual(user.id, 1);\n\t});'),
		withShadowedTestParameter('\ttest(\'local\', t => {\n\t\tt.test(\'child\', () => {\n\t\t\tassert.strictEqual(user.id, 1);\n\t\t\tassert.strictEqual(user.id, 1);\n\t\t});\n\t});'),
		withContextTest('\tfunction helper(t) {\n\t\tt.test(\'child\', () => {\n\t\t\tassert.strictEqual(user.id, 1);\n\t\t\tassert.strictEqual(user.id, 1);\n\t\t});\n\t}\n\thelper(localContext);'),

		// Strict-mode legacy aliases have different semantics from loose legacy methods
		withStrictAndLooseAssert('\tstrictAssert.equal(user.id, 1);\n\tlooseAssert.equal(user.id, 1);'),

		// Await state is part of the statement
		withAsyncTest('\tassert.rejects(promise);\n\tawait assert.rejects(promise);'),
	],
	invalid: [
		// Adjacent duplicate assertion
		withTest('\tassert.strictEqual(user.id, 1);\n\tassert.strictEqual(user.id, 1);'),

		// A test body the call names out of line has its duplicates the same way
		`${head}function body() {\n\tassert.strictEqual(user.id, 1);\n\tassert.strictEqual(user.id, 1);\n}\ntest('user', body);`,
		`${head}const body = () => {\n\tassert.strictEqual(user.id, 1);\n\tassert.strictEqual(user.id, 1);\n};\ntest('user', body);`,
		`${head}function body() {\n\tassert.strictEqual(user.id, 1);\n\tassert.strictEqual(user.id, 1);\n}\ntest('user', {fn: body});`,
		withTest('\tassert.strictEqual(user.id, 1);\n\tassert.strictEqual(user.id, 1);\n\tassert.strictEqual(user.id, 1);'),

		// `node:assert/strict`
		'import test from \'node:test\';\nimport assert from \'node:assert/strict\';\ntest(\'user\', () => {\n\tassert.strictEqual(user.id, 1);\n\tassert.strictEqual(user.id, 1);\n});',

		// Named import
		'import test from \'node:test\';\nimport {strictEqual} from \'node:assert\';\ntest(\'user\', () => {\n\tstrictEqual(user.id, 1);\n\tstrictEqual(user.id, 1);\n});',

		// Namespace import
		'import test from \'node:test\';\nimport * as assert from \'node:assert\';\ntest(\'user\', () => {\n\tassert.strictEqual(user.id, 1);\n\tassert.strictEqual(user.id, 1);\n});',

		// Test context assertion
		withContextTest('\tt.assert.strictEqual(user.id, 1);\n\tt.assert.strictEqual(user.id, 1);'),

		// A wrapped context receiver still resolves to the tracked context
		{
			code: withContextTest('\t(t as any).assert.strictEqual(user.id, 1);\n\t(t as any).assert.strictEqual(user.id, 1);'),
			languageOptions: {parser: parsers.typescript},
		},
		withContextTest('\tt?.assert.strictEqual(user.id, 1);\n\tt?.assert.strictEqual(user.id, 1);'),

		// Nested test bodies are checked independently
		`${head}test('parent', t => {\n\tt.test('child', () => {\n\t\tassert.strictEqual(user.id, 1);\n\t\tassert.strictEqual(user.id, 1);\n\t});\n});`,

		// Bare `assert()` is the same assertion method as `assert.ok()`
		withTest('\tassert(user.active);\n\tassert.ok(user.active);'),

		// Comments between adjacent assertion statements
		withTest('\tassert.strictEqual(user.id, 1);\n\t// Copy-paste leftover\n\tassert.strictEqual(user.id, 1);'),

		// Spread arguments are treated syntactically
		withTest('\tassert.deepStrictEqual(...values);\n\tassert.deepStrictEqual(...values);'),

		// Optional chaining in arguments
		withTest('\tassert.strictEqual(user.profile?.id, 1);\n\tassert.strictEqual(user.profile?.id, 1);'),

		// Awaited async assertions
		withAsyncTest('\tawait assert.rejects(promise);\n\tawait assert.rejects(promise);'),

		// Strict-mode legacy aliases use their strict equivalents for duplicate detection
		withStrictAndLooseAssert('\tstrictAssert.equal(user.id, 1);\n\tlooseAssert.strictEqual(user.id, 1);'),

		// Parenthesized argument
		withTest('\tassert.strictEqual((user.id), 1);\n\tassert.strictEqual(user.id, 1);'),

		// TypeScript wrappers
		{
			code: withTest('\tassert.strictEqual(user.id as number, 1);\n\tassert.strictEqual(user.id, 1);'),
			languageOptions: {parser: parsers.typescript},
		},
		// A wrapper on the whole statement does not hide the assertion
		{
			code: withTest('\tassert.strictEqual(user.id, 1)!;\n\tassert.strictEqual(user.id, 1)!;'),
			languageOptions: {parser: parsers.typescript},
		},
		'// A body the call names out of line is the subtest\'s body\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'import assert from \'node:assert\';\n'
		+ 'const body = () => {\n'
		+ '	assert.ok(x);\n'
		+ '	assert.ok(x);\n'
		+ '};\n'
		+ 'test(\'a\', t => {\n'
		+ '	t.test(\'sub\', body);\n'
		+ '});',
		'// The context of a test body the call names out of line\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'function body(t) {\n'
		+ '	t.assert.ok(a);\n'
		+ '	t.assert.ok(a);\n'
		+ '}\n'
		+ 'test(\'a\', body);',
	],
});

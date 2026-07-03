import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test from 'node:test';\nimport assert from 'node:assert';\n${code}`;
const withBeforeImport = code => `import {before} from 'node:test';\nimport assert from 'node:assert';\n${code}`;
const withNamespaceImport = code => `import * as nodeTest from 'node:test';\nimport assert from 'node:assert';\n${code}`;
const inTest = code => withImport(`test('loads', () => {\n\t${code}\n});`);
const inAsyncTest = code => withImport(`test('loads', async () => {\n\t${code}\n});`);
const inParentTest = code => withImport(`test('parent', t => {\n\t${code}\n});`);

test.snapshot({
	valid: [
		// Not a test file.
		'import assert from \'node:assert\';\nload().then(value => { assert.strictEqual(value, 42); });',

		// Handled chains.
		inAsyncTest('await load().then(value => { assert.strictEqual(value, 42); });'),
		inTest('return load().then(value => { assert.strictEqual(value, 42); });'),
		inTest('const promise = load().then(value => { assert.strictEqual(value, 42); });'),
		withImport('test(\'loads\', () => load().then(value => { assert.strictEqual(value, 42); }));'),

		// Promise callbacks without assertions.
		inTest('load().then(value => { handle(value); });'),
		inTest('load().catch(error => { handle(error); });'),

		// External callbacks are intentionally skipped.
		withImport('const assertionCallback = value => { assert.strictEqual(value, 42); };\ntest(\'loads\', () => {\n\tload().then(assertionCallback);\n});'),

		// Assertions inside nested helper functions are not part of the Promise callback body.
		inTest('load().then(value => { function check() { assert.strictEqual(value, 42); } check(); });'),
		inTest('load().then(value => { const check = () => { assert.strictEqual(value, 42); }; check(); });'),

		// Computed Promise method is unsupported.
		inTest('load()[method](value => { assert.strictEqual(value, 42); });'),

		// Suites are not awaited test bodies.
		'import {describe} from \'node:test\';\nimport assert from \'node:assert\';\ndescribe(\'loads\', () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',
		'import {suite} from \'node:test\';\nimport assert from \'node:assert\';\nsuite(\'loads\', () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',
		'import {test} from \'node:test\';\nimport assert from \'node:assert\';\ntest.describe(\'loads\', () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',
		'import {test} from \'node:test\';\nimport assert from \'node:assert\';\ntest.suite(\'loads\', () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',
		'import test, * as nodeTest from \'node:test\';\nimport assert from \'node:assert\';\ntest.describe(\'loads\', () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',

		// Nested regular functions inside tests are ignored.
		inTest('function helper() { load().then(value => { assert.strictEqual(value, 42); }); } helper();'),

		// `*.assert` only counts for tracked test context names.
		'import test from \'node:test\';\ntest(\'loads\', () => {\n\tload().then(value => { helper.assert.strictEqual(value, 42); });\n});',

		// Shadowed assert bindings are not the imported assertion API.
		withImport('test(\'loads\', () => {\n\tload().then(assert => { assert.strictEqual(value, 42); });\n});'),
		'import test from \'node:test\';\nimport {strictEqual} from \'node:assert\';\ntest(\'loads\', () => {\n\tload().then(strictEqual => { strictEqual(value, 42); });\n});',
		withImport('test(\'loads\', () => {\n\tload().then(() => { const assert = helper; assert.strictEqual(value, 42); });\n});'),
		'import test from \'node:test\';\ntest(\'loads\', async t => {\n\tload().then(t => { t.assert.strictEqual(value, 42); });\n});',

		// Shadowed subtest context names are not node:test contexts.
		inParentTest('function helper(t) {\n\t\tt.test(\'not node:test\', () => {\n\t\t\tload().then(value => { assert.strictEqual(value, 42); });\n\t\t});\n\t}\n\n\thelper(fakeTest);'),

		// Shadowed node:test bindings are not test boundaries.
		withImport('function wrapper(test) {\n\ttest(\'not node:test\', () => {\n\t\tload().then(value => { assert.strictEqual(value, 42); });\n\t});\n}\n\nwrapper(fakeTest);'),
		withBeforeImport('function wrapper(before) {\n\tbefore(() => {\n\t\tload().then(value => { assert.strictEqual(value, 42); });\n\t});\n}\n\nwrapper(fakeBefore);'),
		withNamespaceImport('function wrapper(nodeTest) {\n\tnodeTest.test(\'not node:test\', () => {\n\t\tload().then(value => { assert.strictEqual(value, 42); });\n\t});\n}\n\nwrapper(fakeTest);'),
	],
	invalid: [
		// Imported assert namespace.
		inAsyncTest('load().then(value => { assert.strictEqual(value, 42); });'),

		// `it` alias.
		'import {it} from \'node:test\';\nimport assert from \'node:assert\';\nit(\'loads\', async () => {\n\tload().then(value => { assert.strictEqual(value, 42); });\n});',

		// Assert strict module.
		'import test from \'node:test\';\nimport assert from \'node:assert/strict\';\ntest(\'loads\', async () => {\n\tload().then(value => { assert.equal(value, 42); });\n});',

		// Named and renamed imports.
		'import test from \'node:test\';\nimport {strictEqual} from \'node:assert\';\ntest(\'loads\', async () => {\n\tload().then(value => { strictEqual(value, 42); });\n});',
		'import test from \'node:test\';\nimport {strictEqual as equal} from \'node:assert\';\ntest(\'loads\', async () => {\n\tload().then(value => { equal(value, 42); });\n});',

		// Test context assertion.
		'import test from \'node:test\';\ntest(\'loads\', async t => {\n\tload().then(value => { t.assert.strictEqual(value, 42); });\n});',

		// Rejection callback.
		inAsyncTest('load().then(undefined, error => { assert.ifError(error); });'),

		// Catch/finally.
		inAsyncTest('load().catch(error => { assert.ifError(error); });'),
		inAsyncTest('load().finally(() => { assert.ok(cleanedUp); });'),

		// Chained callbacks.
		inAsyncTest('load().then(value => { assert.strictEqual(value, 42); }).catch(error => { assert.ifError(error); });'),

		// Optional chaining.
		inAsyncTest('promise?.then(value => { assert.strictEqual(value, 42); });'),
		inAsyncTest('load?.().then(value => { assert.strictEqual(value, 42); });'),

		// Void chains are reported but not fixed.
		inAsyncTest('void load().then(value => { assert.strictEqual(value, 42); });'),

		// Non-async callback is reported but not fixed.
		inTest('load().then(value => { assert.strictEqual(value, 42); });'),

		// Hooks.
		'import {before} from \'node:test\';\nimport assert from \'node:assert\';\nbefore(async () => {\n\tsetup().then(value => { assert.strictEqual(value, 42); });\n});',
		'import {beforeEach} from \'node:test\';\nbeforeEach(async t => {\n\tsetup().then(value => { t.assert.strictEqual(value, 42); });\n});',
		'import {afterEach} from \'node:test\';\nimport assert from \'node:assert\';\nafterEach(async () => {\n\tteardown().then(value => { assert.strictEqual(value, 42); });\n});',

		// Subtests.
		withImport('test(\'parent\', async t => {\n\tawait t.test(\'child\', async () => {\n\t\tload().then(value => { assert.strictEqual(value, 42); });\n\t});\n});'),

		// Static blocks cannot be fixed by inserting `await`.
		inAsyncTest('class Fixture {\n\t\tstatic {\n\t\t\tload().then(value => { assert.strictEqual(value, 42); });\n\t\t}\n\t}'),

		// TypeScript wrappers around callbacks.
		{
			code: inAsyncTest('load().then((value => { assert.strictEqual(value, 42); }) as (value: number) => void);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: inAsyncTest('load().then((value => { assert.strictEqual(value, 42); }) satisfies (value: number) => void);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: inAsyncTest('load().then((value => { assert.strictEqual(value, 42); })!);'),
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript wrapper around the whole floating chain.
		{
			code: inAsyncTest('(load().then(value => { assert.strictEqual(value, 42); }) as Promise<void>);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

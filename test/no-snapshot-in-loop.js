import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTest = code => `import test from 'node:test';\ntest('t', t => {\n\t${code}\n});`;

test.snapshot({
	valid: [
		// Snapshot outside a loop.
		withTest('t.assert.snapshot(value);'),

		// Not a test file.
		'for (const item of items) { t.assert.snapshot(item); }',

		// `fileSnapshot()` is explicitly named and not position-based.
		withTest('for (const item of items) { t.assert.fileSnapshot(item, path); }'),

		// Snapshot configuration APIs are not snapshot assertions.
		'import {snapshot} from \'node:test\';\nfor (const serializer of serializers) { snapshot.setDefaultSnapshotSerializers([serializer]); }',

		// The top-level `node:test` assert export configures TestContext assertions. It is not the TestContext assertion object.
		'import test, {assert} from \'node:test\';\nfor (const value of values) { assert.snapshot(value); }',
		'import * as nodeTest from \'node:test\';\nfor (const value of values) { nodeTest.assert.snapshot(value); }',
		'import test from \'node:test\';\nfor (const value of values) { test.assert.snapshot(value); }',

		// Unrelated object with an `assert.snapshot` method.
		withTest('for (const item of items) { custom.assert.snapshot(item); }'),
		withTest('for (const item of items) { const t = custom; t.assert.snapshot(item); }'),

		// Computed properties are intentionally ignored.
		withTest('for (const item of items) { t.assert[\'snapshot\'](item); }'),
		withTest('for (const item of items) { t[\'assert\'].snapshot(item); }'),

		// Calls in loop condition/update positions are not in the loop body.
		withTest('for (; t.assert.snapshot(value);) {}'),
		withTest('for (let index = 0; index < 1; t.assert.snapshot(index)) {}'),
		withTest('while (t.assert.snapshot(value)) {}'),
		withTest('do {} while (t.assert.snapshot(value));'),

		// Nested functions and callbacks are intentionally ignored by this rule.
		withTest('for (const item of items) { function check() { t.assert.snapshot(item); } check(); }'),
		withTest('for (const item of items) { const check = () => { t.assert.snapshot(item); }; check(); }'),
		withTest('const check = () => { for (const item of items) { t.assert.snapshot(item); } }; check();'),
		withTest('items.forEach(() => { for (const item of items) { t.assert.snapshot(item); } });'),
		withTest('for (const item of items) { items.map(() => { t.assert.snapshot(item); }); }'),

		// Generating separate tests or subtests in a loop is fine because each callback gets its own test context.
		'import test from \'node:test\';\nfor (const item of items) { test(String(item), t => { t.assert.snapshot(item); }); }',
		'import test from \'node:test\';\ntest(\'t\', t => { for (const item of items) { t.test(String(item), t => { t.assert.snapshot(item); }); } });',
		'import test from \'node:test\';\nconst fakeContext = {assert: {snapshot() {}}};\nfor (const item of items) { test(String(item), {skip: fakeContext.assert.snapshot(item)}, t => {}); }',

		// Shadowed test functions are not `node:test` registrations.
		'import test from \'node:test\';\n{\n\tconst test = customTest;\n\ttest(\'t\', t => { for (const item of items) { t.assert.snapshot(item); } });\n}',
		'import * as nodeTest from \'node:test\';\n{\n\tconst nodeTest = customTest;\n\tnodeTest.test(\'t\', t => { for (const item of items) { t.assert.snapshot(item); } });\n}',

		// Unknown chained test calls are not `node:test` registrations.
		'import test from \'node:test\';\ntest.foo(\'t\', t => { for (const item of items) { t.assert.snapshot(item); } });',
		'import * as nodeTest from \'node:test\';\nnodeTest.test.foo(\'t\', t => { for (const item of items) { t.assert.snapshot(item); } });',
		'import test from \'node:test\';\ntest(\'t\', t => { t.test.foo(\'subtest\', t => { for (const item of items) { t.assert.snapshot(item); } }); });',

		// Array callback iteration is intentionally out of scope for this narrow rule.
		withTest('items.forEach(item => { t.assert.snapshot(item); });'),
	],
	invalid: [
		// For-of loop body.
		withTest('for (const item of items) { t.assert.snapshot(item); }'),
		withTest('for (const item of items) t.assert.snapshot(item);'),
		withTest('for (const item of items) { if (condition) { t.assert.snapshot(item); } }'),
		withTest('for (const item of items) { for (; t.assert.snapshot(item);) {} }'),

		// For-await-of loop body.
		'import test from \'node:test\';\ntest(\'t\', async t => { for await (const item of items) { t.assert.snapshot(item); } });',

		// Classic for loop body.
		withTest('for (let index = 0; index < 3; index++) { t.assert.snapshot(items[index]); }'),

		// While loop body with a renamed context parameter.
		'import test from \'node:test\';\ntest(\'t\', context => { while (condition) { context.assert.snapshot(value); } });',

		// Do-while loop body.
		withTest('do { t.assert.snapshot(value); } while (condition);'),

		// For-in loop body.
		withTest('for (const key in object) { t.assert.snapshot(object[key]); }'),

		// TypeScript syntax.
		{
			code: withTest('for (const item of items as string[]) { t.assert.snapshot(item); }'),
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript wrappers.
		{
			code: 'import test from \'node:test\';\n(test as typeof test)(\'t\', t => { for (const item of items) { t.assert.snapshot(item); } });',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withTest('for (const item of items) { t!.assert.snapshot(item); }'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withTest('for (const item of items) { (t as TestContext).assert.snapshot(item); }'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withTest('for (const item of items) { t.assert!.snapshot(item); }'),
			languageOptions: {parser: parsers.typescript},
		},

		// Optional chaining.
		withTest('for (const item of items) { t.assert?.snapshot(item); }'),

		// Named and renamed imports.
		'import {it} from \'node:test\';\nit(\'t\', t => { for (const item of items) { t.assert.snapshot(item); } });',
		'import {test as run} from \'node:test\';\nrun(\'t\', t => { for (const item of items) { t.assert.snapshot(item); } });',

		// Test modifiers.
		'import test from \'node:test\';\ntest.only(\'t\', t => { for (const item of items) { t.assert.snapshot(item); } });',
		'import * as nodeTest from \'node:test\';\nnodeTest.test.skip(\'t\', t => { for (const item of items) { t.assert.snapshot(item); } });',

		// Default and namespace forms.
		'import test from \'node:test\';\ntest.test(\'t\', t => { for (const item of items) { t.assert.snapshot(item); } });',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'t\', t => { for (const item of items) { t.assert.snapshot(item); } });',

		// Subtest context.
		'import test from \'node:test\';\ntest(\'t\', t => { t.test(\'subtest\', t => { for (const item of items) { t.assert.snapshot(item); } }); });',
		'import test from \'node:test\';\ntest(\'t\', async t => { await t.test.only(\'subtest\', t => { for (const item of items) { t.assert.snapshot(item); } }); });',
		{
			code: 'import test from \'node:test\';\ntest(\'t\', t => { t!.test(\'subtest\', t => { for (const item of items) { t.assert.snapshot(item); } }); });',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Hooks run around ordinary and TODO subtests.
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); t.afterEach(() => {}); await t.test(\'child\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {todo: true}, () => {}); });'),

		// Chained `.todo`/`.only` subtests are still runnable, so the hook is meaningful
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test.todo(\'child\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test.only(\'child\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test.only.todo(\'child\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: false}, () => {}); });'),
		withTest('const shouldSkip = false;\ntest(\'parent\', async t => { t.afterEach(() => {}); await t.test(\'child\', {skip: shouldSkip}, () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: true, skip: false}, () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\'); });'),
		withTest('test(\'parent\', async (t = undefined) => { t.beforeEach(() => {}); await t.test(\'child\', () => {}); });'),
		withTest('test(\'parent\', async t => { t?.afterEach(() => {}); await t.test(\'child\', () => {}); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); test(\'child\', () => {}); });'),
		withTest('test(\'parent\', t => { t.afterEach(() => {}); test.todo(\'child\', () => {}); });'),
		withTest('test(\'parent\', t => { t.afterEach(() => {}); test.expectFailure(\'child\', () => {}); });'),
		withTest('test(\'parent\', parent => { parent.beforeEach(() => {}); test(\'child\', child => { child.afterEach(() => {}); test(\'grandchild\', () => {}); }); });'),
		'import test, {it} from \'node:test\';\ntest(\'parent\', t => { t.beforeEach(() => {}); it(\'child\', () => {}); });',
		'import test, {it} from \'node:test\';\ntest(\'parent\', t => { t.afterEach(() => {}); it.expectFailure(\'child\', () => {}); });',
		'import test, {test as specify} from \'node:test\';\ntest(\'parent\', t => { t.beforeEach(() => {}); specify(\'child\', () => {}); });',
		'import test, * as nodeTest from \'node:test\';\ntest(\'parent\', t => { t.afterEach(() => {}); nodeTest.test(\'child\', () => {}); });',
		withTest('test(\'parent\', () => { test.skip(\'child\', t => { t.afterEach(() => {}); }); });'),
		withTest('test(\'parent\', () => { test(\'child\', {skip: true}, t => { t.beforeEach(() => {}); }); });'),
		withTest('test.skip(\'skipped\', () => { test(\'child\', t => { t.afterEach(() => {}); }); });'),
		withTest('test(\'skipped\', {skip: true}, () => { test(\'child\', t => { t.beforeEach(() => {}); }); });'),
		withTest('test.expectFailure(\'skipped\', {skip: true}, () => { test(\'child\', t => { t.afterEach(() => {}); }); });'),
		'import test, {describe} from \'node:test\';\ndescribe.skip(\'skipped\', () => { test(\'child\', t => { t.beforeEach(() => {}); }); });',
		'import test, {suite as group} from \'node:test\';\ngroup(\'skipped\', {skip: true}, () => { test(\'child\', t => { t.afterEach(() => {}); }); });',
		{
			code: withTest('test(\'parent\', async t => { t.afterEach(() => {}); await (t as object).test(\'child\', () => {}); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// These hooks run for the current test, including leaf tests.
		withTest('test(\'leaf\', t => { t.before(() => {}); t.after(() => {}); });'),

		// The parent has a child, while the child uses no context hooks.
		withTest('test(\'parent\', async parent => { parent.beforeEach(() => {}); await parent.test(\'child\', () => {}); });'),
		'import {test as specify} from \'node:test\';\nspecify(\'parent\', async t => { t.afterEach(() => {}); await t.test(\'child\', () => {}); });',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', () => {}); });',

		// Lookalikes and shadowed bindings are ignored.
		withTest('test(\'leaf\', t => { const hooks = {beforeEach() {}}; hooks.beforeEach(); });'),
		withTest('test(\'leaf\', t => { { const t = {afterEach() {}}; t.afterEach(); } });'),
		withTest('test(\'leaf\', () => { unknown.beforeEach(() => {}); });'),
		withTest('test(\'leaf\', t => { function configure() { t.beforeEach(() => {}); } });'),
		withTest('test(\'leaf\', t => { t.before(() => { t.afterEach(() => {}); }); });'),
		'test(\'leaf\', t => { t.beforeEach(() => {}); });',

		// TypeScript wrappers around the context still resolve correctly.
		{
			code: withTest('test(\'parent\', async t => { (t as object).beforeEach(() => {}); await t.test(\'child\', () => {}); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Leaf test context hooks.
		withTest('test(\'leaf\', t => { t.beforeEach(() => {}); });'),
		withTest('test(\'leaf\', t => { t.afterEach(() => {}); });'),
		withTest('test.expectFailure(\'leaf\', t => { t.beforeEach(() => {}); });'),
		withTest('test(\'leaf\', t => { t?.beforeEach(() => {}); });'),
		withTest('test(\'leaf\', t => { t.beforeEach(() => {}); t.afterEach(() => {}); });'),
		withTest('test(\'leaf\', (t = undefined) => { t.beforeEach(() => {}); });'),

		// Skipped test and suite callbacks do not run.
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: true}, () => {}); });'),
		withTest('test(\'parent\', async t => { t.afterEach(() => {}); await t.test(\'child\', {skip: \'not ready\'}, () => {}); });'),
		withTest('const shouldSkip = true;\ntest(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: shouldSkip}, () => {}); });'),
		withTest('test(\'parent\', async t => { t.afterEach(() => {}); await t.test(\'child\', {skip: false, skip: true}, () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test.skip(\'child\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test.only.skip(\'child\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test.skip.todo(\'child\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test.todo.skip(\'child\', () => {}); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); test.skip(\'child\', () => {}); });'),
		withTest('test(\'parent\', t => { t.afterEach(() => {}); test(\'child\', {skip: true}, () => {}); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); test(\'child\', {skip: true, todo: true}, () => {}); });'),

		// A leaf subtest has no child subtests of its own.
		withTest('test(\'parent\', async t => { await t.test(\'child\', child => { child.afterEach(() => {}); }); });'),

		// The nested parameter shadows the parent context binding.
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', t => { t.beforeEach(() => {}); }); });'),

		// Subtests inside hooks are never registered for a leaf test.
		withTest('test(\'leaf\', t => { t.beforeEach(() => { t.test(\'child\', () => {}); }); });'),
		withTest('test(\'leaf\', t => { t.afterEach(() => { t.test(\'child\', () => {}); }); });'),
		withTest('test(\'leaf\', t => { t.beforeEach(() => { t.test(\'child\', child => { child.afterEach(() => {}); }); }); });'),
		withTest('test(\'leaf\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: true}, child => { child.afterEach(() => {}); }); });'),

		{
			code: withTest('test(\'leaf\', t => { (t as object).afterEach(() => {}); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: true as boolean}, () => {}); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

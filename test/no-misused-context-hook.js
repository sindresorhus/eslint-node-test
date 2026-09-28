import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// A subtest created inside an iteration callback still runs, so the hook is meaningful.
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await Promise.all(items.map(item => t.test(item, () => {}))); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); for (const item of items) { await t.test(item, () => {}); } });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); while (hasMore()) { await t.test(\'x\', () => {}); } });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); items.forEach(item => { t.test(item, () => {}); }); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); items.find(item => t.test(item, () => {})); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); items.findIndex(item => t.test(item, () => {})); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); items.findLast(item => t.test(item, () => {})); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); items.findLastIndex(item => t.test(item, () => {})); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); items.reduce((all, item) => t.test(item, () => {}), []); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); items.filter(item => t.test(item, () => {})); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); items.some(item => t.test(item, () => {})); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); items.sort(() => { t.test(\'x\', () => {}); return 0; }); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); Array.from(items, () => { t.test(\'x\', () => {}); }); });'),

		// A suite callback runs while the file is collected, so a subtest in one is registered before
		// the test body finishes and the hooks really do run around it.
		'import {test, describe} from \'node:test\';\ntest(\'parent\', t => { t.beforeEach(() => {}); describe(\'d\', () => { t.test(\'x\', () => {}); }); });',
		'import {test, suite} from \'node:test\';\ntest(\'parent\', t => { t.beforeEach(() => {}); suite(\'d\', () => { t.test(\'x\', () => {}); }); });',
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); items.every(item => t.test(item, () => {})); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); items.flatMap(item => [t.test(item, () => {})]); });'),
		// The other loop forms, and a `switch` case, are part of the test body too
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); for (let index = 0; index < count; index += 1) { await t.test(\'x\', () => {}); } });'),
		withTest('test(\'parent\', t => { t.afterEach(() => {}); do { t.test(\'x\', () => {}); } while (hasMore()); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); switch (mode) { case \'a\': t.test(\'x\', () => {}); break; } });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); for (const batch of batches) { items.map(item => t.test(item, () => {})); } });'),
		// A function that is called where it is written is not a scope boundary
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); (() => { t.test(\'child\', () => {}); })(); await t.test(\'sibling\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); (function () { t.test(\'child\', () => {}); })(); await t.test(\'sibling\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); (() => t.test(\'child\', () => {}))(); await t.test(\'sibling\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); new (class { constructor() { t.test(\'child\', () => {}); } })(); await t.test(\'sibling\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); new (() => { t.test(\'child\', () => {}); })(); await t.test(\'sibling\', () => {}); });'),
		// A context hook written inside such a function belongs to it, not to the test, so it is not found
		withTest('test(\'leaf\', t => { items.map(item => { t.beforeEach(() => {}); }); });'),
		withTest('test(\'leaf\', t => { (() => { t.afterEach(() => {}); })(); });'),
		// Hooks run around ordinary and TODO subtests.
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); t.afterEach(() => {}); await t.test(\'child\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {todo: true}, () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: false}, () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: shouldSkip()}, () => {}); });'),
		withTest('const shouldSkip = false;\ntest(\'parent\', async t => { t.afterEach(() => {}); await t.test(\'child\', {skip: shouldSkip}, () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: true, skip: false}, () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\'); });'),
		withTest('test(\'parent\', async (t = undefined) => { t.beforeEach(() => {}); await t.test(\'child\', () => {}); });'),
		withTest('test(\'parent\', async t => { t?.afterEach(() => {}); await t.test(\'child\', () => {}); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); test(\'child\', () => {}); });'),
		withTest('test(\'parent\', t => { t.afterEach(() => {}); test.todo(\'child\', () => {}); });'),
		withTest('test(\'parent\', t => { t.afterEach(() => {}); test.expectFailure(\'child\', () => {}); });'),
		withTest('test(\'parent\', parent => { parent.beforeEach(() => {}); test(\'child\', child => { child.afterEach(() => {}); test(\'grandchild\', () => {}); }); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); test(\'child\', t2 => { t.test(\'grandchild\', () => {}); }); });'),
		'import test, {it} from \'node:test\';\ntest(\'parent\', t => { t.beforeEach(() => {}); it(\'child\', () => {}); });',
		'import test, {it} from \'node:test\';\ntest(\'parent\', t => { t.afterEach(() => {}); it.expectFailure(\'child\', () => {}); });',
		'import test, {test as specify} from \'node:test\';\ntest(\'parent\', t => { t.beforeEach(() => {}); specify(\'child\', () => {}); });',
		'import test, * as nodeTest from \'node:test\';\ntest(\'parent\', t => { t.afterEach(() => {}); nodeTest.test(\'child\', () => {}); });',
		withTest('test(\'parent\', () => { test.skip(\'child\', t => { t.afterEach(() => {}); }); });'),
		withTest('test(\'parent\', () => { test(\'child\', {skip: true}, t => { t.beforeEach(() => {}); }); });'),
		withTest('test.skip(\'skipped\', () => { test(\'child\', t => { t.afterEach(() => {}); }); });'),
		withTest('test(\'skipped\', {skip: true}, () => { test(\'child\', t => { t.beforeEach(() => {}); }); });'),
		withTest('test(\'parent\', t => { t.test(\'child\', {skip: true}, child => { child.beforeEach(() => {}); }); });'),
		withTest('test.expectFailure(\'skipped\', {skip: true}, () => { test(\'child\', t => { t.afterEach(() => {}); }); });'),
		'import test, {describe} from \'node:test\';\ndescribe.skip(\'skipped\', () => { test(\'child\', t => { t.beforeEach(() => {}); }); });',
		'import test, {suite as group} from \'node:test\';\ngroup(\'skipped\', {skip: true}, () => { test(\'child\', t => { t.afterEach(() => {}); }); });',
		// A suite with `{skip: 0}` runs its body, but `node:test` cancels the tests it registers, so their callbacks never run
		'import test, {describe} from \'node:test\';\ndescribe(\'skipped\', {skip: 0}, () => { test(\'child\', t => { t.beforeEach(() => {}); }); });',
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
		withTest('test(\'leaf\', t => { t[\'beforeEach\'](() => {}); });'),
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

		// A hook and its subtest both reached through `getTestContext()`
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', async () => {\n\tgetTestContext().beforeEach(() => {});\n\tawait getTestContext().test(\'c\', () => {});\n});',
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', async () => { await getTestContext().test(\'c\', () => {}); });',
		'import test, {getTestContext} from \'node:test\';\ntest(\'a\', async () => {\n\ttest.getTestContext().beforeEach(() => {});\n\tawait test.getTestContext().test(\'c\', () => {});\n});',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'a\', async () => { nodeTest.getTestContext().beforeEach(() => {}); await nodeTest.getTestContext().test(\'c\', () => {}); });',
		'import test, {getTestContext} from \'node:test\';\ntest(\'a\', t => { t.beforeEach(() => {}); getTestContext().test(\'c\', () => {}); });',
		// An unrelated object is not a test context
		'import {test} from \'node:test\';\ntest(\'a\', t => { foo.beforeEach(() => {}); });',
		'// `reduceRight` calls a predicate over the elements too, so the subtest still runs\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'test(\'a\', t => {\n'
		+ '	t.beforeEach(() => {});\n'
		+ '	[1, 2].reduceRight((accumulator, index) => {\n'
		+ '		t.test(\'c\' + index, () => {});\n'
		+ '		return accumulator;\n'
		+ '	}, []);\n'
		+ '});',
		'// A test registered in a callback the body invokes right there is a subtest of that test\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'test(\'a\', t => {\n'
		+ '	t.beforeEach(() => {});\n'
		+ '	[1, 2].forEach(i => {\n'
		+ '		test(\'c\' + i, () => {});\n'
		+ '	});\n'
		+ '});',
		'import {test} from \'node:test\';\ntest(\'a\', t => {\n	t.beforeEach(() => {});\n	(() => {\n		test(\'c\', () => {});\n	})();\n});',
		'import {test} from \'node:test\';\ntest(\'a\', t => {\n	t.beforeEach(() => {});\n	Array.from([1, 2], i => {\n		test(\'c\' + i, () => {});\n	});\n});',
	],
	invalid: [
		// `Array.of(…)` makes an array of its arguments, so it runs nothing, and the third argument
		// of `Array.from` is a `thisArg` it passes on rather than calling.
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); Array.of(1, () => { t.test(\'x\', () => {}); }); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); Array.from(items, item => item, () => { t.test(\'x\', () => {}); }); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); items.map(item => item, () => { t.test(\'x\', () => {}); }); });'),

		// `node:test` skips for anything that is neither `undefined` nor `false`, so the child is not
		// runnable and the hook has nothing to apply to
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: 0}, () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: \'\'}, () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: null}, () => {}); });'),
		withTest('test(\'parent\', async t => { t.afterEach(() => {}); await t.test(\'child\', {skip: Number.NaN}, () => {}); });'),
		withTest('test(\'parent\', t => { t.beforeEach(() => {}); test(\'child\', {skip: 0}, () => {}); });'),
		// Only a truthy `skip` stops the test's own body, so a hook in a `{skip: 0}` test still runs and still has no subtest
		withTest('test(\'leaf\', {skip: 0}, t => { t.beforeEach(() => { prepare(); }); work(); });'),
		withTest('test(\'leaf\', {skip: \'\'}, t => { t.afterEach(() => {}); });'),
		withTest('test(\'parent\', {skip: null}, () => { test(\'child\', t => { t.beforeEach(() => {}); }); });'),
		// A second argument to an array method is `thisArg`, which the method never calls, so a
		// subtest written there never runs
		withTest('test(\'p\', t => { t.beforeEach(() => {}); items.map(() => {}, function () { t.test(\'a\', () => {}); }); });'),
		withTest('test(\'p\', t => { t.beforeEach(() => {}); items.filter(() => true, function () { t.test(\'a\', () => {}); }); });'),
		// A declared helper is a real scope boundary, so its subtests do not count even inside a loop
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); items.map(item => { function inner() { return t.test(item, () => {}); } }); });'),
		withTest('test(\'p\', t => { t.beforeEach(() => {}); each(() => t.test(\'a\', () => {})); });'),
		// A computed array method is not an iteration, so its callback is a scope boundary
		withTest('test(\'p\', t => { t.beforeEach(() => {}); items[\'forEach\'](item => { t.test(\'a\', () => {}); }); });'),

		// Leaf test context hooks.
		withTest('test(\'leaf\', t => { t.beforeEach(() => {}); });'),
		withTest('test(\'leaf\', t => { t.afterEach(() => {}); });'),
		withTest('test.expectFailure(\'leaf\', t => { t.beforeEach(() => {}); });'),
		withTest('test(\'leaf\', t => { t?.beforeEach(() => {}); });'),
		withTest('test(\'leaf\', t => { t.beforeEach(() => {}); t.afterEach(() => {}); });'),
		withTest('test(\'leaf\', (t = undefined) => { t.beforeEach(() => {}); });'),
		// A test declared in a suite body is a leaf like any other
		'import test, {describe} from \'node:test\';\ndescribe(\'s\', () => { test(\'a\', t => { t.beforeEach(() => {}); }); });',

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
			code: withTest('test(\'leaf\', t => { (t satisfies object).beforeEach(() => {}); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test(\'child\', {skip: true as boolean}, () => {}); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// A hook reached through `getTestContext()` with no runnable subtest is the same misuse
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', () => {\n\tgetTestContext().beforeEach(() => {});\n});',
		// Optional chaining does not hide the receiver
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', () => { getTestContext()?.beforeEach(() => {}); });',
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', async () => {\n\tgetTestContext().beforeEach(() => {});\n\tawait getTestContext().test(\'c\', {skip: true}, () => {});\n});',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'a\', () => { nodeTest.getTestContext().afterEach(() => {}); });',

		// `t.test` has no `skip`, `only` or `todo` method, so a chained call throws and registers
		// nothing, which leaves the hook with no subtest to run around
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test.todo(\'child\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test.only(\'child\', () => {}); });'),
		withTest('test(\'parent\', async t => { t.beforeEach(() => {}); await t.test.only.todo(\'child\', () => {}); });'),

		// Only a truthy `skip` stops a subtest's own body, so the hooks of a `{skip: 0}` subtest created with `t.test()` still run and still have no subtest, the same as with the imported `test()`
		withTest('test(\'parent\', t => { t.test(\'child\', {skip: 0}, t2 => { t2.beforeEach(() => {}); }); });'),
	],
});

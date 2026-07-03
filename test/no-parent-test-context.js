import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'function test(t) { t.test(\'child\', () => { t.mock.fn(); }); }',

		// Normal top-level context usage
		withImport('test(\'parent\', t => { t.mock.fn(); t.plan(1); t.assert.ok(true); });'),

		// Shadowed `test` binding is not a node:test call
		withImport('function wrapper(test) { test(\'parent\', t => { t.test(\'child\', () => { t.mock.fn(); }); }); }'),

		// Subtest uses its own context
		withImport('test(\'parent\', async t => { await t.test(\'child\', t2 => { t2.mock.method(fs, \'readFileSync\', () => \'{}\'); }); });'),
		withImport('test(\'parent\', async t => { await t.test(\'child\', t2 => { t2.plan(1); t2.assert.ok(true); }); });'),

		// Same-name subtest parameter shadows the parent context
		withImport('test(\'parent\', async t => { await t.test(\'child\', t => { t.mock.fn(); }); });'),

		// Parent context used to create/configure the subtest, not inside the child callback body
		withImport('test(\'parent\', async t => { await t.test(t.name, {skip: t.signal.aborted}, t2 => { t2.mock.fn(); }); });'),

		// `t.test` where `t` is not a test context parameter
		withImport('test(\'parent\', () => { t.test(\'child\', () => { t.mock.fn(); }); });'),

		// Shadowed local with the same name as the parent context is not a subtest receiver
		withImport('test(\'parent\', async t => { await t.test(\'child\', t2 => { const t = {test(name, callback) { callback(); }}; t.test(\'not a subtest\', () => { t2.mock.fn(); }); }); });'),

		// Shadowed local with the same name as the parent context is not a parent-context reference
		withImport('test(\'parent\', async t => { await t.test(\'child\', t2 => { const t = {mock: {fn() {}}}; t.mock.fn(); }); });'),

		// Nested subtests consistently use the innermost context
		withImport('test(\'parent\', async t => { await t.test(\'child\', async t2 => { await t2.test(\'grandchild\', t3 => { t3.mock.fn(); }); }); });'),

		// Non-inline callbacks are not analyzed
		withImport('test(\'parent\', async t => { await t.test(\'child\', helper); });\nfunction helper() { t.mock.fn(); }'),
	],
	invalid: [
		// Child callback without a context parameter
		withImport('test(\'parent\', async t => { await t.test(\'child\', () => { t.mock.fn(); }); });'),
		withImport('test(\'parent\', async t => { await t.test(\'child\', () => { t.plan(1); }); });'),
		withImport('test(\'parent\', async t => { await t.test(\'child\', () => { t.assert.ok(true); }); });'),
		withImport('test(\'parent\', async t => { await t.test(\'child\', async () => { await t.test(\'grandchild\', () => {}); }); });'),

		// Child callback has its own context, so a suggestion can replace the parent reference
		withImport('test(\'parent\', async t => { await t.test(\'child\', t2 => { t.mock.method(fs, \'readFileSync\', () => \'{}\'); }); });'),
		withImport('test(\'parent\', async t => { await t.test(\'child\', t2 => t.mock.fn()); });'),
		withImport('test(\'parent\', async t => { await t.test.only(\'child\', t2 => { t.mock.fn(); }); });'),

		// Child context name shadowed at the report site has no safe suggestion
		withImport('test(\'parent\', async t => { await t.test(\'child\', t2 => { { const t2 = other; t.mock.fn(); } }); });'),

		// Shorthand property suggestions would change the property name, so only report
		withImport('test(\'parent\', async t => { await t.test(\'child\', t2 => { const value = {t}; }); });'),

		// Destructured child context has no safe identifier to suggest
		withImport('test(\'parent\', async t => { await t.test(\'child\', ({mock}) => { t.mock.fn(); }); });'),

		// Parent context in child parameter defaults
		withImport('test(\'parent\', async t => { await t.test(\'child\', (t2 = t) => {}); });'),

		// Named and namespace imports
		'import {test} from \'node:test\';\ntest(\'parent\', async t => { await t.test(\'child\', t2 => { t.mock.fn(); }); });',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'parent\', async t => { await t.test(\'child\', t2 => { t.mock.fn(); }); });',

		// Renamed parent context
		withImport('test(\'parent\', async context => { await context.test(\'child\', () => { context.mock.fn(); }); });'),

		// Grandchild references the grandparent
		withImport('test(\'parent\', async t => { await t.test(\'child\', async t2 => { await t2.test(\'grandchild\', t3 => { t.mock.fn(); }); }); });'),

		// Grandchild references the parent
		withImport('test(\'parent\', async t => { await t.test(\'child\', async t2 => { await t2.test(\'grandchild\', t3 => { t2.mock.fn(); }); }); });'),

		// Parent context referenced inside a nested helper function declared within the subtest
		withImport('test(\'parent\', async t => { await t.test(\'child\', t2 => { function helper() { t.mock.fn(); } helper(); }); });'),

		// TypeScript
		{
			code: withImport('test(\'parent\', async (t: any) => { await t.test(\'child\', (t2: any) => { t.mock.fn(); }); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

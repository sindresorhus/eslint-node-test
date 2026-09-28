import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const setup = 'import {describe, it, before, after, beforeEach, afterEach} from \'node:test\';\nimport assert from \'node:assert\';\n';
const withSetup = code => setup + code;

test.snapshot({
	valid: [
		// Assertion inside a test — fine
		withSetup('it(\'a\', () => { assert.ok(value); });'),

		// Assertion inside a subtest — fine
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'t\', async t => { await t.test(\'s\', () => { assert.ok(value); }); });',

		// Hook with non-assertion setup — fine
		withSetup('beforeEach(() => { state = createState(); });'),

		// Assertion in a helper called from a hook — not directly in the hook body
		withSetup('beforeEach(() => { check(); });\nfunction check() { assert.ok(value); }'),

		// Not a test file
		'assert.ok(value);',

		// `.assert.*` on a non-context object inside a hook — not a test context
		withSetup('beforeEach(() => { const obj = {assert: {ok() {}}}; obj.assert.ok(value); });'),

		// A callback nested in the hook body is not the hook body itself
		'import {beforeEach} from \'node:test\';\nimport assert from \'node:assert\';\nbeforeEach(() => { items.forEach(() => { assert.ok(value); }); });',

		// A hook never runs `options.fn`, so a body named there is not a hook body
		withSetup('beforeEach({fn: body});\nfunction body() { assert.ok(value); }'),
	],
	invalid: [
		// Assertion directly in each hook type
		withSetup('before(() => { assert.ok(value); });'),
		withSetup('after(() => { assert.ok(value); });'),
		withSetup('beforeEach(() => { assert.strictEqual(a, b); });'),
		withSetup('beforeEach(() => { assert.ok(value); }, {timeout: 1000});'),
		withSetup('afterEach(() => { assert(value); });'),
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest.beforeEach(() => { assert.ok(value); }, {timeout: 1000});',
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest.after(() => { assert.ok(value); });',

		// Hook inside a describe
		withSetup('describe(\'suite\', () => { beforeEach(() => { assert.ok(value); }); });'),
		withSetup('describe(\'suite\', () => { before(async () => { assert.ok(value); }); });'),

		// Hooks declared through a namespace import
		'import * as nodeTest from \'node:test\';\nimport assert from \'node:assert\';\nnodeTest.beforeEach(() => { assert.ok(value); });',

		// A hook declared inside a subtest is still a hook
		'import {test, beforeEach} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'p\', async t => { await t.test(\'c\', () => { beforeEach(() => { assert.ok(value); }); }); });',

		// A hook body the call names out of line runs as a hook
		withSetup('beforeEach(body);\nfunction body() { assert.ok(value); }'),
		withSetup('const body = () => { assert.ok(value); };\nbefore(body);'),
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest.afterEach(body);\nfunction body() { assert.ok(value); }',

		// Nested inside a conditional within the hook body
		withSetup('beforeEach(() => { if (x) { assert.ok(value); } });'),

		// Context assert inside a hook (hook receives a context)
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.assert.ok(value); });',
		'import test from \'node:test\';\ntest(\'t\', t => { t.beforeEach(hook => { hook.assert.ok(value); }); });',

		// Imported assertions inside a context hook.
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'t\', t => { t.beforeEach(() => { assert.ok(value); }); });',

		// TypeScript-wrapped hook callbacks.
		{
			code: 'import {beforeEach} from \'node:test\';\nimport assert from \'node:assert\';\nbeforeEach((() => { assert.ok(value); }) as () => void);',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from \'node:test\';\ntest(\'t\', t => { t.beforeEach((hook => { hook.assert.ok(value); }) as () => void); });',
			languageOptions: {parser: parsers.typescript},
		},

		// A hook declared through `getTestContext()` is the same hook
		'import {test, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'p\', t => { getTestContext().beforeEach(() => { assert.ok(1); }); });',
	],
});

import {getTester} from './utils/test.js';

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
	],
	invalid: [
		// Assertion directly in each hook type
		withSetup('before(() => { assert.ok(value); });'),
		withSetup('after(() => { assert.ok(value); });'),
		withSetup('beforeEach(() => { assert.strictEqual(a, b); });'),
		withSetup('beforeEach(() => { assert.ok(value); }, {timeout: 1000});'),
		withSetup('afterEach(() => { assert(value); });'),
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest.beforeEach(() => { assert.ok(value); }, {timeout: 1000});',

		// Hook inside a describe
		withSetup('describe(\'suite\', () => { beforeEach(() => { assert.ok(value); }); });'),

		// Nested inside a conditional within the hook body
		withSetup('beforeEach(() => { if (x) { assert.ok(value); } });'),

		// Context assert inside a hook (hook receives a context)
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.assert.ok(value); });',
	],
});

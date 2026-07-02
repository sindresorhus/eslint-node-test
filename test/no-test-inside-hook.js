import {getTester} from './utils/test.js';

const {test} = getTester(import.meta);

const setup = 'import {test, it, describe, suite, before, after, beforeEach, afterEach} from \'node:test\';\n';
const withSetup = code => setup + code;

test.snapshot({
	valid: [
		// Tests at the top level
		withSetup('it(\'a\', () => {});'),

		// Tests inside a describe
		withSetup('describe(\'s\', () => { it(\'a\', () => {}); });'),

		// Hook with normal setup/teardown
		withSetup('beforeEach(() => { state = createState(); });'),
		withSetup('after(() => { cleanup(); });'),

		// Subtest inside a test — the supported pattern
		'import test from \'node:test\';\ntest(\'t\', async t => { await t.test(\'s\', () => {}); });',

		// Test defined in a helper that a hook happens to call (lexically outside the hook)
		withSetup('beforeEach(() => { register(); });\nfunction register() { it(\'a\', () => {}); }'),

		// Not a test file
		'beforeEach(() => { it(\'a\', () => {}); });',
	],
	invalid: [
		// `it` inside each hook type
		withSetup('beforeEach(() => { it(\'a\', () => {}); });'),
		withSetup('before(() => { test(\'a\', () => {}); });'),
		withSetup('afterEach(() => { it(\'a\', () => {}); });'),

		// `describe`/`suite` inside a hook
		withSetup('before(() => { describe(\'s\', () => {}); });'),
		withSetup('after(() => { suite(\'s\', () => {}); });'),

		// Hook inside a describe, test inside the hook
		withSetup('describe(\'outer\', () => { beforeEach(() => { it(\'a\', () => {}); }); });'),

		// Nested in a conditional inside the hook body
		withSetup('beforeEach(() => { if (x) { it(\'a\', () => {}); } });'),
	],
});

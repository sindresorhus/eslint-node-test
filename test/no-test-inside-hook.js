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
		// A test callback named out of line is the test's own body
		'import {before, test} from \'node:test\';\nconst setup = () => { test(\'a\', () => {}); };\ntest(\'t\', setup);',
		'import {before, test} from \'node:test\';\nconst body = () => { test(\'a\', () => {}); };\ntest(\'t\', body);',
		// A helper the hook merely calls is a different case, and is left alone
		'import {before, test} from \'node:test\';\nbefore(() => { setup(); });\nfunction setup() { test(\'a\', () => {}); }',
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

		// Hook with a trailing options argument — the callback is the first argument
		withSetup('beforeEach(() => { it(\'a\', () => {}); }, {timeout: 1000});'),
		// A hook declared on a test context is still a hook
		'import test from \'node:test\';\ntest(\'o\', t => { t.beforeEach(() => { test(\'inner\', () => {}); }); });',
		'import test from \'node:test\';\ntest(\'o\', t => { t.after(() => { test(\'inner\', () => {}); }); });',

		// A hook declared through `getTestContext()` is the same hook
		'import {test, getTestContext} from \'node:test\';\ntest(\'o\', t => { getTestContext().after(() => { test(\'inner\', () => {}); }); });',

		// A subtest inside a hook is dropped the same way an imported `test()` call is
		'import {test} from \'node:test\';\ntest(\'a\', t => { t.beforeEach(() => { t.test(\'b\', () => {}); }); });',
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.test(\'b\', () => {}); });',
		'import {before} from \'node:test\';\nbefore(t => { t.test(\'b\', () => {}); });',

		// A hook callback the call names out of line runs as the hook's body, so a test in it is
		// registered nowhere
		'import {before, test} from \'node:test\';\nbefore(setup);\nfunction setup() { test(\'a\', () => {}); }',
		'import {before, test} from \'node:test\';\nconst setup = () => { test(\'a\', () => {}); };\nbefore(setup);',
		'import {before, describe} from \'node:test\';\nbefore(setup);\nfunction setup() { describe(\'a\', () => {}); }',
		'import {beforeEach, test} from \'node:test\';\nbeforeEach(setup);\nfunction setup() { test(\'a\', () => {}); }',
		'// A context hook body named out of line still drops the test declared inside it\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'function body() {\n'
		+ '	test(\'x\', () => {});\n'
		+ '}\n'
		+ 'test(\'a\', t => {\n'
		+ '	t.beforeEach(body);\n'
		+ '});',
	],
});

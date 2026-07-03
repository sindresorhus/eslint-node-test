import {getTester} from './utils/test.js';

const {test} = getTester(import.meta);

const inTest = code => `import test from 'node:test';\ntest('t', t => {\n\t${code}\n});`;

test.snapshot({
	valid: [
		// Already using diagnostic
		inTest('t.diagnostic(\'starting\');'),

		// Console outside a test
		'import test from \'node:test\';\nconsole.log(\'top level\');',

		// Console inside a test without a context parameter — nothing to suggest
		'import test from \'node:test\';\ntest(\'t\', () => { console.log(\'x\'); });',

		// Console in the title/options arguments — outside the callback body, where the context is not in scope
		'import test from \'node:test\';\ntest(console.log(\'title\'), t => {});',
		'import test from \'node:test\';\ntest(\'t\', {timeout: console.log(\'x\')}, t => {});',

		// Shadowed test binding
		'import test from \'node:test\';\nfunction helper(test) { test(\'t\', t => { console.log(\'value\'); }); }',

		// `console.error`/`console.warn` are not targeted
		inTest('console.error(\'real error\');'),
		inTest('console.warn(\'warning\');'),

		// Not a test file
		'console.log(\'x\');',
	],
	invalid: [
		// Single-argument console.log — suggestion offered
		inTest('console.log(\'value\');'),
		inTest('console.log(message);'),

		// Multiple arguments — reported but no suggestion (diagnostic takes one message)
		inTest('console.log(\'value\', value);'),

		// `console.info` / `console.debug`
		inTest('console.info(\'info\');'),
		inTest('console.debug(\'debug\');'),

		// Inside a subtest
		'import test from \'node:test\';\ntest(\'t\', async t => { await t.test(\'s\', s => { console.log(\'sub\'); }); });',

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'t\', t => { console.log(\'value\'); });',
	],
});

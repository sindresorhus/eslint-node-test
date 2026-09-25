import {getTester, parsers} from './utils/test.js';

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

		// A shadowed context name is not the test context, so `t.diagnostic(…)` would throw
		'import test from \'node:test\';\ntest(\'t\', t => { { const t = 1; console.log(\'value\'); } });',
		'import test from \'node:test\';\ntest(\'t\', t => { function inner(t) { console.log(\'value\'); } inner(1); });',
		'import test from \'node:test\';\ntest(\'t\', t => { try { f(); } catch (t) { console.log(\'value\'); } });',
		'import test from \'node:test\';\ntest(\'t\', t => { for (const t of xs) { console.log(\'value\'); } });',

		// A local `console` is some other object, so `t.diagnostic(…)` is not a replacement
		'import test from \'node:test\';\ntest(\'t\', t => { const console = {log() {}}; console.log(\'x\'); });',
		'import test from \'node:test\';\ntest(\'t\', function (t, console) { console.log(\'x\'); });',
		'import test from \'node:test\';\ntest(\'t\', t => { function inner(console) { console.log(\'x\'); } inner(console); });',
		'import test from \'node:test\';\ntest(\'t\', t => { try { f(); } catch (console) { console.log(\'x\'); } });',

		// A local binding shadows an aliased `getTestContext` import just as it shadows the context parameter
		'import {test, getTestContext as gtc} from \'node:test\';\ntest(\'a\', () => { const gtc = () => {}; console.log(\'x\'); });',

		// `console.error`/`console.warn` are not targeted
		inTest('console.error(\'real error\');'),
		inTest('console.warn(\'warning\');'),

		// Not a test file
		'console.log(\'x\');',

		// Nothing to rewrite outside a test callback, even when the file imports getTestContext
		'import {getTestContext} from \'node:test\';\nconsole.log(\'top level\');',
		'import test, {describe, getTestContext} from \'node:test\';\ndescribe(\'s\', () => { console.log(\'x\'); });',
		'import test, {describe, getTestContext} from \'node:test\';\ntest(\'a\', console.log(\'in the title\'), () => {});',
	],
	invalid: [
		// Replacing the whole callee would drop the comment inside it, so no suggestion
		inTest('console./* keep me */log(\'hi\');'),
		inTest('console/* keep me */.log(\'hi\');'),

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
		// A `console` receiver wrapped in a TypeScript cast is still `console`.
		{
			code: inTest('(console as Console).log(\'x\');'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: inTest('console!.log(\'x\');'),
			languageOptions: {parser: parsers.typescript},
		},

		// A test that declares no context parameter can still reach it through `getTestContext()`
		'import {test, getTestContext} from \'node:test\';\ntest(\'t\', () => { console.log(\'x\'); });',
		'import {test, getTestContext} from \'node:test\';\ntest(\'t\', t => { console.log(\'x\'); });',

		// `getTestContext` under any local alias is the same import
		'import {test, getTestContext as gtc} from \'node:test\';\ntest(\'a\', () => { console.log(\'x\'); });',
	],
});

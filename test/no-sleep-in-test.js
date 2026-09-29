import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const indent = code => code.split('\n').map(line => `\t${line}`).join('\n');
const withTest = code => `import test from 'node:test';\ntest('waits', async t => {\n${indent(code)}\n});`;
const withTimerImport = code => `import test from 'node:test';\nimport {setTimeout as delay} from 'node:timers';\ntest('waits', async () => {\n${indent(code)}\n});`;
const withPromiseTimerImport = code => `import test from 'node:test';\nimport {setTimeout as delay} from 'node:timers/promises';\ntest('waits', async () => {\n${indent(code)}\n});`;
const withPromiseTimerContextImport = code => `import test from 'node:test';\nimport {setTimeout as delay} from 'node:timers/promises';\ntest('waits', async t => {\n${indent(code)}\n});`;
const withPromiseTimerNamespaceImport = code => `import test from 'node:test';\nimport * as timers from 'node:timers/promises';\ntest('waits', async () => {\n${indent(code)}\n});`;
const withNodeTestPromiseTimerImport = code => [
	'import {describe, test} from \'node:test\';',
	'import {setTimeout as delay} from \'node:timers/promises\';',
	code,
].join('\n');
// A body that sleeps, declared out of line.
const sleepingBody = 'const body = async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n};\n';
// A suite body that registers a sleeping test, declared out of line.
const sleepingSuiteBody = 'const suiteBody = () => {\n\ttest(\'waits\', async () => {\n\t\tawait new Promise(resolve => setTimeout(resolve, 500));\n\t});\n};\n';
const withSuitePromiseTimerImport = (callee, options, code) => withNodeTestPromiseTimerImport([
	`${callee}('suite', ${options}() => {`,
	indent(code),
	'});',
].join('\n'));

test.snapshot({
	valid: [
		// A suite body and a helper the test body calls are separate cases
		'import {describe} from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nconst body = async () => { await delay(500); };\ndescribe(\'s\', body);',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nconst body = async () => { await delay(500); };\ntest(\'waits\', () => { body(); });',

		// Not a test file.
		'await new Promise(resolve => setTimeout(resolve, 500));',

		withTest('await once(emitter, \'done\');'),
		withTest('await new Promise(resolve => emitter.once(\'done\', resolve));'),
		withTest('setTimeout(tick, 500);'),
		withTest('t.mock.timers.enable({apis: [\'setTimeout\']});\nsetTimeout(tick, 500);\nt.mock.timers.tick(500);'),
		withTest('await new Promise(resolve => setImmediate(resolve));'),
		withTest('await new Promise(resolve => setTimeout(otherFunction, 500));'),
		withTest('const setTimeout = callback => callback();\nawait new Promise(resolve => setTimeout(resolve, 500));'),
		withTest('const globalThis = {setTimeout(callback) {\n\tcallback();\n}};\nawait new Promise(resolve => globalThis.setTimeout(resolve, 500));'),
		withTest('const global = {setTimeout(callback) {\n\tcallback();\n}};\nawait new Promise(resolve => global.setTimeout(resolve, 500));'),
		'import {setTimeout} from \'node:timers/promises\';\nimport test from \'node:test\';\ntest(\'waits\', async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n});',
		'import Promise from \'some-promise\';\nimport test from \'node:test\';\ntest(\'waits\', async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n});',
		withTest('await new Promise(resolve => setTimeout(resolve => resolve(), 500));'),
		withTest('await new Promise(resolve => {\n\tfunction later() {\n\t\tsetTimeout(resolve, 500);\n\t}\n\tregister(later);\n});'),
		withTest('function sleep() {\n\treturn new Promise(resolve => setTimeout(resolve, 500));\n}\nawait sleep();'),
		withTest('library.test(\'child\', () => {\n\tnew Promise(resolve => setTimeout(resolve, 500));\n});'),
		withTest('{\n\tconst t = library;\n\tt.test(\'child\', () => {\n\t\tnew Promise(resolve => setTimeout(resolve, 500));\n\t});\n}'),
		withTest('{\n\tconst test = library.test;\n\ttest(\'child\', () => {\n\t\tnew Promise(resolve => setTimeout(resolve, 500));\n\t});\n}'),
		withTest('test.mock.fn(() => {\n\tnew Promise(resolve => setTimeout(resolve, 500));\n});'),
		withTimerImport('const delay = callback => callback();\nawait new Promise(resolve => delay(resolve, 500));'),
		withPromiseTimerImport('const delay = async () => {};\nawait delay(500);'),
		withPromiseTimerImport('function sleep() {\n\treturn delay(500);\n}\nawait sleep();'),
		withPromiseTimerNamespaceImport('const timers = {setTimeout: async () => {}};\nawait timers.setTimeout(500);'),
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest.skip(\'waits\', async () => {\n\tawait delay(500);\n});',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest(\'waits\', {skip: true}, async () => {\n\tawait delay(500);\n});',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest.expectFailure(\'waits\', {skip: true}, async () => {\n\tawait delay(500);\n});',
		withPromiseTimerContextImport('await t.test.skip(\'child\', async () => {\n\tawait delay(500);\n});'),
		withPromiseTimerContextImport('await t.test(\'child\', {skip: true}, async () => {\n\tawait delay(500);\n});'),
		withPromiseTimerContextImport('function registerSubtest() {\n\tt.test(\'child\', async () => {\n\t\tawait delay(500);\n\t});\n}'),
		withPromiseTimerContextImport('function registerHook() {\n\tt.beforeEach(async () => {\n\t\tawait delay(500);\n\t});\n}'),
		withPromiseTimerContextImport('const hooks = library;\nhooks.beforeEach(async () => {\n\tawait delay(500);\n});'),
		withNodeTestPromiseTimerImport('test.skip(\'outer\', () => {\n\ttest(\'inner\', async () => {\n\t\tawait delay(500);\n\t});\n});'),
		withPromiseTimerContextImport('await t.test.skip(\'outer\', () => {\n\tt.test(\'inner\', async () => {\n\t\tawait delay(500);\n\t});\n});'),
		'import test from \'node:test\';\nfunction sleep() {\n\treturn new Promise(resolve => setTimeout(resolve, 500));\n}\ntest(\'waits\', async () => {\n\tawait sleep();\n});',
		'import {describe} from \'node:test\';\ndescribe(\'suite\', () => {\n\tnew Promise(resolve => setTimeout(resolve, 500));\n});',
		'import {describe} from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ndescribe(\'suite\', async () => {\n\tawait delay(500);\n});',
		withSuitePromiseTimerImport('describe.skip', '', 'test(\'waits\', async () => {\n\tawait delay(500);\n});'),
		withSuitePromiseTimerImport('describe', '{skip: true}, ', 'test(\'waits\', async () => {\n\tawait delay(500);\n});'),

		// A shadowed `resolve` is not the executor's resolver
		withTest('await new Promise(resolve => {\n\t{\n\t\tconst resolve = other;\n\t\tsetTimeout(resolve, 500);\n\t}\n});'),
		// A sleep in a nested helper body is out of scope, as the doc says
		withTest('const later = async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n};\nawait later();'),
		// A shadowed `Promise` is not the global constructor
		withTest('const Promise = class {};\nawait new Promise(resolve => setTimeout(resolve, 500));'),
		// Only a function executor has parameters the resolver can be matched against
		withTest('await new Promise(sleep);'),
		// The object form puts the options first, and `skip` reads the same there
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest({name: \'waits\', skip: true, fn: async () => {\n\tawait delay(500);\n}});',
		// `skip` marks the test skipped on anything that is neither `undefined` nor `false`, but only a truthy one stops the body, so `{skip: 0}` is in `invalid` A hook takes its callback first, so the runner never runs an options `fn`
		'import {beforeEach} from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nbeforeEach({fn: async () => {\n\tawait delay(1);\n}});',
		'// A skipped test never runs its body, out of line exactly as inline\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'import {setTimeout as delay} from \'node:timers/promises\';\n'
		+ 'const body = async () => {\n'
		+ '	await delay(500);\n'
		+ '};\n'
		+ 'test(\'a\', {skip: true}, body);',
		'// An unrelated object\'s `test` method is not a registration, so its callback is not a test body\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'import {setTimeout as delay} from \'node:timers/promises\';\n'
		+ 'function body() {\n'
		+ '	return delay(500);\n'
		+ '}\n'
		+ 'foo.test(\'a\', body);',
		// A skip modifier, the standalone `skip` export, and a skipped suite around the call never run a body named out of line either
		'import {test} from \'node:test\';\n' + sleepingBody + 'test.skip(\'a\', body);',
		'import {skip} from \'node:test\';\n' + sleepingBody + 'skip(\'a\', body);',
		'import {describe, test} from \'node:test\';\n' + sleepingBody + 'describe.skip(\'s\', () => {\n	test(\'a\', body);\n});',
		'import {describe, test} from \'node:test\';\n' + sleepingBody + 'describe(\'s\', {skip: true}, () => {\n	test(\'a\', body);\n});',
		'import {describe, test} from \'node:test\';\n' + sleepingBody + 'describe(\'s\', {skip: true, fn: () => {\n	test(\'a\', body);\n}});',
		'import {describe, test} from \'node:test\';\n' + sleepingBody + 'describe({name: \'s\', skip: true, fn: () => {\n	test(\'a\', body);\n}});',
		{
			code: 'import {describe, test} from \'node:test\';\n' + sleepingBody + 'describe(\'s\', {skip: true, fn: () => {\n	test(\'a\', body);\n}} as any);',
			languageOptions: {parser: parsers.typescript},
		},
		// `TestContext#test` has no `skip` member, so the call throws and never runs the body
		'import {test} from \'node:test\';\n' + sleepingBody + 'test(\'a\', async t => {\n	await t.test.skip(\'b\', body);\n});',
		// A skipped suite whose body is named out of line never runs the tests it registers, whether their bodies are inline or out of line too
		'import {describe, test} from \'node:test\';\n' + sleepingSuiteBody + 'describe.skip(\'s\', suiteBody);',
		'import {describe, test} from \'node:test\';\n'
		+ 'describe(\'s\', {skip: true}, suiteBody);\n'
		+ 'function suiteBody() {\n'
		+ '	test(\'waits\', async () => {\n'
		+ '		await new Promise(resolve => setTimeout(resolve, 500));\n'
		+ '	});\n'
		+ '}',
		'import {describe, test} from \'node:test\';\n' + sleepingBody + 'const suiteBody = () => {\n	test(\'a\', body);\n};\ndescribe.skip(\'s\', suiteBody);',
		'import {describe, test} from \'node:test\';\n' + sleepingSuiteBody + 'describe.skip(\'outer\', () => {\n	describe(\'s\', suiteBody);\n});',
		// Limitation: a body named out of line is read through the first call that registers it, so a body shared by a skipped registration and a later live one is not reported
		'import {test} from \'node:test\';\n' + sleepingBody + 'test.skip(\'a\', body);\ntest(\'b\', body);',
		'import {describe, test} from \'node:test\';\n' + sleepingSuiteBody + 'describe.skip(\'s\', suiteBody);\ndescribe(\'t\', suiteBody);',
	],
	invalid: [
		withTest('await new Promise(resolve => setTimeout(resolve, 500));'),

		// Two suite bodies that register each other still end the walk up to a skipped registration
		'import {describe, test} from \'node:test\';\n'
		+ 'function first() {\n	describe(\'x\', second);\n}\n'
		+ 'function second() {\n	describe(\'y\', first);\n	test(\'a\', async () => { await new Promise(resolve => setTimeout(resolve, 500)); });\n}',

		// A test body the call names out of line is still a test body
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nasync function body() { await delay(500); }\ntest(\'waits\', body);',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nconst body = async () => { await delay(500); };\ntest(\'waits\', body);',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nconst body = async () => { await delay(500); };\ntest(\'waits\', {fn: body});',
		withTest('return new Promise(resolve => setTimeout(resolve, 500));'),
		'import test from \'node:test\';\ntest(\'waits\', {timeout: 1000}, async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n});',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest(\'waits\', {skip: undefined}, async () => {\n\tawait delay(500);\n});',
		// A skip enabled by a falsy value carries the `# SKIP` directive and still runs the body
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest(\'waits\', {skip: 0}, async () => {\n\tawait delay(500);\n});',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest(\'waits\', {skip: \'\'}, async () => {\n\tawait delay(500);\n});',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest(\'waits\', {skip: null}, async () => {\n\tawait delay(500);\n});',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest(\'waits\', () => delay(500));',
		'import test from \'node:test\';\ntest.only(\'waits\', async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n});',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest.expectFailure(\'waits\', async () => {\n\tawait delay(500);\n});',
		'import {it} from \'node:test\';\nit(\'waits\', async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n});',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'waits\', async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n});',
		'import {beforeEach} from \'node:test\';\nbeforeEach(async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n});',
		'import {beforeEach} from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nbeforeEach(async () => {\n\tawait delay(500);\n}, {timeout: 1000});',
		'import {after} from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nafter(async () => {\n\tawait delay(500);\n});',
		'import test from \'node:test\';\ntest.beforeEach(async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n});',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest.beforeEach(async () => {\n\tawait delay(500);\n});',
		'import * as nodeTest from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nnodeTest.beforeEach(async () => {\n\tawait delay(500);\n}, {timeout: 1000});',
		'import * as nodeTest from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nnodeTest.test.beforeEach(async () => {\n\tawait delay(500);\n}, {timeout: 1000});',
		'import {beforeEach} from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nbeforeEach(async () => {\n\tawait delay(500);\n}, {skip: true});',
		'import {test} from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest.beforeEach(async () => {\n\tawait delay(500);\n}, {skip: true});',
		// A trailing object after the callback is not the options slot, so the test still runs
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest(\'waits\', async () => {\n\tawait delay(500);\n}, {skip: true});',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest.beforeEach(async () => {\n\tawait delay(500);\n}, {skip: true});',
		withTest('await t.test(\'child\', async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n});'),
		'import test from \'node:test\';\ntest(\'waits\', async context => {\n\tawait context.test(\'child\', async () => {\n\t\tawait new Promise(resolve => setTimeout(resolve, 500));\n\t});\n});',
		withTest('await new Promise(resolve => {\n\tsetTimeout(resolve, 500);\n});'),
		withTest('await new Promise(resolve => {\n\tif (ready) {\n\t\tsetTimeout(resolve, 500);\n\t}\n});'),
		withTest('await new Promise(resolve => {\n\tif (setTimeout(resolve, 500)) {\n\t\tcleanup();\n\t}\n});'),
		withTest('await new Promise(resolve => {\n\tready && setTimeout(resolve, 500);\n});'),
		withTest('await new Promise(resolve => {\n\tready ? setTimeout(resolve, 500) : undefined;\n});'),
		withTest('await new Promise(resolve => {\n\treturn setTimeout(resolve, 500);\n});'),
		withTest('await new Promise(done => setTimeout(done, 500));'),
		withTest('await new Promise((resolve, reject) => setTimeout(reject, 500));'),
		withTest('await new Promise((resolve, reject) => setTimeout(() => reject(), 500));'),
		withTest('await new Promise(resolve => setTimeout(resolve));'),
		withTest('await new Promise(resolve => {\n\tconst timeout = setTimeout(resolve, 500);\n\treturn timeout;\n});'),
		withTest('await new Promise(resolve => setTimeout(() => resolve(), 500));'),
		withTest('await new Promise(resolve => setTimeout(() => resolve()));'),
		withTest('await new Promise(resolve => setTimeout(() => {\n\treturn resolve();\n}, 500));'),
		withTest('await new Promise(resolve => setTimeout(() => {\n\tif (ready) {\n\t\tresolve();\n\t}\n}, 500));'),
		withTest('await new Promise(resolve => setTimeout(() => ready && resolve(), 500));'),
		withTest('await new Promise(resolve => setTimeout(function () {\n\tresolve();\n}, 500));'),
		withTest('await new Promise(resolve => globalThis.setTimeout(resolve, 500));'),
		withTest('await new Promise(resolve => global.setTimeout(resolve, 500));'),
		withTimerImport('await new Promise(resolve => delay(resolve, 500));'),
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'timers\';\ntest(\'waits\', async () => {\n\tawait new Promise(resolve => delay(resolve, 500));\n});',
		'import test from \'node:test\';\nimport * as timers from \'node:timers\';\ntest(\'waits\', async () => {\n\tawait new Promise(resolve => timers.setTimeout(resolve, 500));\n});',
		'import test from \'node:test\';\nimport * as timers from \'timers\';\ntest(\'waits\', async () => {\n\tawait new Promise(resolve => timers.setTimeout(resolve, 500));\n});',
		'import test from \'node:test\';\nimport timers from \'node:timers\';\ntest(\'waits\', async () => {\n\tawait new Promise(resolve => timers.setTimeout(resolve, 500));\n});',
		withPromiseTimerImport('await delay(500);'),
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'timers/promises\';\ntest(\'waits\', async () => {\n\tawait delay(500);\n});',
		'import test from \'node:test\';\nimport * as timers from \'node:timers/promises\';\ntest(\'waits\', async () => {\n\tawait timers.setTimeout(500);\n});',
		'import test from \'node:test\';\nimport * as timers from \'timers/promises\';\ntest(\'waits\', async () => {\n\tawait timers.setTimeout(500);\n});',
		'import test from \'node:test\';\nimport timers from \'node:timers/promises\';\ntest(\'waits\', async () => {\n\tawait timers.setTimeout(500);\n});',
		'import test from \'node:test\';\nimport timers from \'timers/promises\';\ntest(\'waits\', async () => {\n\tawait timers.setTimeout(500);\n});',
		'import {before} from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nbefore(async () => {\n\tawait delay(500);\n});',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest.todo(\'waits\', async () => {\n\tawait delay(500);\n});',
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest(\'waits\', {todo: \'later\'}, async () => {\n\tawait delay(500);\n});',
		withPromiseTimerContextImport('await t.test(\'child\', async () => {\n\tawait delay(500);\n});'),
		withPromiseTimerContextImport('await t.test.todo(\'child\', async () => {\n\tawait delay(500);\n});'),
		withPromiseTimerContextImport('await t.test(\'child\', {expectFailure: true}, async () => {\n\tawait delay(500);\n});'),
		withPromiseTimerContextImport('t.beforeEach(async () => {\n\tawait delay(500);\n}, {timeout: 1000});'),
		withPromiseTimerContextImport('t.beforeEach(async () => {\n\tawait delay(500);\n}, {skip: true});'),
		withPromiseTimerContextImport('t.afterEach(async () => {\n\tawait delay(500);\n});'),
		withPromiseTimerContextImport('await t.test(\'child\', async subtest => {\n\tsubtest.beforeEach(async () => {\n\t\tawait delay(500);\n\t});\n});'),
		withSuitePromiseTimerImport('describe', '', 'test(\'waits\', async () => {\n\tawait delay(500);\n});'),
		withSuitePromiseTimerImport('describe', '{skip: false}, ', 'test(\'waits\', async () => {\n\tawait delay(500);\n});'),
		{
			code: 'import test from \'node:test\';\ntest(\'waits\', async () => {\n\tawait new Promise<void>(resolve => setTimeout(resolve, 500));\n});',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: [
				'import test from \'node:test\';',
				'import {setTimeout as delay} from \'node:timers/promises\';',
				'test(\'waits\', {skip: false as boolean}, async () => {',
				'\tawait delay(500);',
				'});',
			].join('\n'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: [
				'import test from \'node:test\';',
				'import {setTimeout as delay} from \'node:timers/promises\';',
				'test(\'waits\', async t => {',
				'\t(t as TestContext).beforeEach(async () => {',
				'\t\tawait delay(500);',
				'\t});',
				'});',
			].join('\n'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: [
				'import {describe, test} from \'node:test\';',
				'import {setTimeout as delay} from \'node:timers/promises\';',
				'describe.skip(\'suite\', (() => {',
				'\ttest(\'ignored\', async () => {',
				'\t\tawait delay(500);',
				'\t});',
				'}) as () => void);',
				'test(\'waits\', async () => {',
				'\tawait delay(500);',
				'});',
			].join('\n'),
			languageOptions: {parser: parsers.typescript},
		},
		// A TypeScript-wrapped namespace receiver is still the imported setTimeout.
		{
			code: 'import test from \'node:test\';\nimport * as timers from \'node:timers/promises\';\ntest(\'a\', async () => { await (timers as any).setTimeout(1); });',
			languageOptions: {parser: parsers.typescript},
		},

		// A defaulted context parameter is still the context, so its subtests are still tracked
		'import {test} from \'node:test\';\nimport {setTimeout as sleep} from \'node:timers/promises\';\n'
		+ 'test(\'a\', async (t = {}) => { await t.test(\'b\', async () => { await sleep(10); }); });',
		// A `getTestContext()` subtest or hook is the same subtest or hook
		'import {test, getTestContext} from \'node:test\';\n'
		+ 'import {setTimeout as sleep} from \'node:timers/promises\';\n'
		+ 'test(\'a\', async () => { await getTestContext().test(\'b\', async () => { await sleep(1); }); });',
		'import {test, getTestContext} from \'node:test\';\n'
		+ 'import {setTimeout as sleep} from \'node:timers/promises\';\n'
		+ 'test(\'a\', async () => { getTestContext().beforeEach(async () => { await sleep(1); }); });',

		// The object form runs its `fn` property
		'import test from \'node:test\';\ntest({name: \'waits\', fn: async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n}});',
		// An unrenamed named timer import is the same `setTimeout`
		'import test from \'node:test\';\nimport {setTimeout} from \'node:timers\';\ntest(\'waits\', async () => {\n\tawait new Promise(resolve => setTimeout(resolve, 500));\n});',
		'import test from \'node:test\';\nimport timers from \'timers\';\ntest(\'waits\', async () => {\n\tawait new Promise(resolve => timers.setTimeout(resolve, 500));\n});',
		// A function expression executor has parameters just like an arrow
		withTest('await new Promise(function executor(resolve) {\n\tsetTimeout(resolve, 500);\n});'),
		// The options `fn` is the callback `node:test` runs, ahead of a later positional function
		'import test from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\ntest(\'waits\', {fn: async () => {\n\tawait delay(1);\n}}, async () => {});',
		// `.only` leaves the subtest active, unlike `.skip` and `.todo`
		withPromiseTimerContextImport('await t.test.only(\'child\', async () => {\n\tawait delay(500);\n});'),
		// Both promise-timer bindings are collected, so both calls report
		[
			'import test from \'node:test\';',
			'import {setTimeout as delay} from \'node:timers/promises\';',
			'import {setTimeout as pause} from \'timers/promises\';',
			'test(\'waits\', async () => {',
			'\tawait delay(500);',
			'\tawait pause(500);',
			'});',
		].join('\n'),
		// A default and a namespace binding of the same `node:test` import are both usable
		'import test, * as nodeTest from \'node:test\';\nimport {setTimeout as delay} from \'node:timers/promises\';\nnodeTest.it(\'waits\', async () => {\n\tawait delay(1);\n});',
		{
			code: withTest('await new Promise(resolve => (setTimeout!)(resolve, 500));'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withPromiseTimerImport('await (delay as (milliseconds: number) => Promise<void>)(500);'),
			languageOptions: {parser: parsers.typescript},
		},

		// A string-literal name is the same export, and it sleeps the same way
		'import test from \'node:test\';\nimport {\'setTimeout\' as st} from \'node:timers\';\ntest(\'waits\', async () => { await new Promise(resolve => st(resolve, 500)); });',
		'// A body the call names out of line is the subtest\'s body\n'
		+ 'import {test} from \'node:test\';\n'
		+ 'import {setTimeout as delay} from \'node:timers/promises\';\n'
		+ 'const body = async () => {\n'
		+ '	await delay(500);\n'
		+ '};\n'
		+ 'test(\'a\', async t => {\n'
		+ '	await t.test(\'sub\', body);\n'
		+ '});',
		// A suite that runs its callback, and a modifier that still runs the body
		'import {describe, test} from \'node:test\';\n' + sleepingBody + 'describe(\'s\', () => {\n	test.only(\'a\', body);\n});',
		// A suite body named out of line runs when its suite is not skipped
		'import {describe, test} from \'node:test\';\n' + sleepingSuiteBody + 'describe(\'s\', suiteBody);',
		// A `skip` that cannot be resolved statically proves nothing, so the suite is treated as running
		withSuitePromiseTimerImport('describe', '{skip: process.env.SKIP}, ', 'test(\'waits\', async () => {\n\tawait delay(500);\n});'),
		// Only a truthy `skip` stops a suite body from running, so a falsy one such as `{skip: 0}` still runs the suite's hooks
		'import {describe, before, it} from \'node:test\';\n'
		+ 'import {setTimeout as delay} from \'node:timers/promises\';\n'
		+ 'describe(\'s\', {skip: 0}, () => {\n'
		+ '\tbefore(async () => {\n'
		+ '\t\tawait delay(500);\n'
		+ '\t});\n'
		+ '\tit(\'a\', () => {});\n'
		+ '});',
		// Limitation: a suite with a falsy `skip` cancels the tests it registers, but they are still checked
		withSuitePromiseTimerImport('describe', '{skip: 0}, ', 'test(\'waits\', async () => {\n\tawait delay(500);\n});'),
	],
});

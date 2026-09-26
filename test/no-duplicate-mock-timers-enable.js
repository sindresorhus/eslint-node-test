import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test, {mock} from 'node:test';\n${code}`;
const withNamedImport = names => `import {mock, ${names}} from 'node:test';`;

test.snapshot({
	valid: [
		withImport('class A {\n\tstatic {\n\t\tmock.timers.enable();\n\t\tmock.timers.reset();\n\t\tmock.timers.enable();\n\t}\n}'),
		// A standalone `only` still runs unless the options slot says otherwise
		`${withNamedImport('only')}\nonly('t', {skip: true}, () => { mock.timers.enable(); mock.timers.enable(); });`,
		`${withNamedImport('only')}\nonly({name: 't', skip: true, fn() { mock.timers.enable(); mock.timers.enable(); }});`,
		// Not a test file.
		'mock.timers.enable();\nmock.timers.enable();',

		// Only a context's own `mock` names its tracker, and only an identifier can name it.
		withImport('test("title", () => { foo.bar.mock.timers.enable(); foo.bar.mock.timers.enable(); });'),
		withImport('unknown.mock.timers.enable();\nunknown.mock.timers.enable();'),
		withImport('test("title", t => { t["mock"].timers.enable(); t.mock.timers.enable(); });'),

		// One enable per tracker.
		withImport('mock.timers.enable();'),
		withImport('test("first", t => { t.mock.timers.enable(); });\ntest("second", t => { t.mock.timers.enable(); });'),
		withImport('test("parent", async t => { await t.test("first", child => { child.mock.timers.enable(); }); await t.test("second", child => { child.mock.timers.enable(); }); });'),
		// A parent and its subtest have trackers of their own, and no state is shared between callbacks
		withImport('test("parent", t => { t.mock.timers.enable(); t.test("child", child => { child.mock.timers.enable(); }); });'),
		withImport('test.skip("title", t => { t.mock.timers.enable(); t.mock.timers.enable(); });'),
		// A nested skipped test never runs, whether it is skipped by the chained modifier or through
		// the options slot of a subtest
		withImport('test("title", t => { test.skip("nested", () => { mock.timers.enable(); mock.timers.enable(); }); });'),
		withImport('test("parent", t => { t.test("child", {skip: true}, child => { child.mock.timers.enable(); child.mock.timers.enable(); }); });'),
		// The standalone `skip` export has an identifier callee, and its body never runs
		`${withNamedImport('skip')}\nskip('title', () => { mock.timers.enable(); mock.timers.enable(); });`,
		`${withNamedImport('skip as skipped')}\nskipped('title', () => { mock.timers.enable(); mock.timers.enable(); });`,
		`${withNamedImport('skip')}\nskip('title', t => { t.mock.timers.enable(); t.mock.timers.enable(); });`,
		withImport('test("title", {skip: true}, t => { t.mock.timers.enable(); t.mock.timers.enable(); });'),
		withImport('test.skip("parent", t => { t.test("child", child => { child.mock.timers.enable(); child.mock.timers.enable(); }); });'),
		withImport('test.skip("title", t => { t.beforeEach(hookContext => { hookContext.mock.timers.enable(); hookContext.mock.timers.enable(); }); });'),
		'import {describe, mock} from \'node:test\';\ndescribe.skip("title", () => { mock.timers.enable(); mock.timers.enable(); });',

		// Resets permit another enable.
		withImport('mock.timers.enable();\nmock.timers.reset();\nmock.timers.enable();'),
		withImport('mock.timers.enable();\nmock.reset();\nmock.timers.enable();'),
		// `test.mock` is the same global tracker under another spelling, so either reset clears it
		withImport('mock.timers.enable();\ntest.mock.reset();\nmock.timers.enable();'),
		withImport('test("title", t => { t.mock.timers.enable(); t.mock.reset(); t.mock.timers.enable(); });'),
		'import {mock as tracker} from \'node:test\';\ntracker.timers.enable();\ntracker.reset();\ntracker.timers.enable();',

		// A reset that runs on every path clears the tracked state.
		withImport('mock.timers.enable();\nif (condition) { mock.timers.reset(); } else { mock.reset(); }\nmock.timers.enable();'),
		withImport('mock.timers.enable();\ntry { callback(); } finally { mock.timers.reset(); }\nmock.timers.enable();'),
		// Mutually exclusive branches each enable once, so no single path enables twice
		withImport('if (condition) { mock.timers.enable(); } else { mock.timers.enable(); }'),

		// Unsupported aliases, destructuring, computed properties, optional calls, helper functions, and repeated loop iterations.
		withImport('const timers = mock.timers;\ntimers.enable();\ntimers.enable();'),
		withImport('const {timers} = mock;\ntimers.enable();\ntimers.enable();'),
		withImport('mock.timers["enable"]();\nmock.timers.enable();'),
		withImport('mock.timers.enable?.();\nmock.timers.enable();'),
		withImport('mock.timers?.enable();\nmock.timers.enable();'),
		withImport('test("title", t => { t?.mock.timers.enable(); t.mock.timers.enable(); });'),
		withImport('test("title", ({mock}) => { mock.timers.enable(); mock.timers.enable(); });'),
		withImport('function enableTimers() { mock.timers.enable(); }\nenableTimers();\nenableTimers();'),
		withImport('for (const value of values) { mock.timers.enable(); }'),
		'import {describe, mock} from \'node:test\';\ndescribe.unknown("title", () => { mock.timers.enable(); mock.timers.enable(); });',

		// TypeScript wrappers around the receiver.
		{
			code: withImport('test("title", (t: any) => { (t.mock as any).timers.enable(); (t.mock as any).timers.reset(); (t.mock as any).timers.enable(); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// `getTestContext()` names the same tracker as the context parameter
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', t => {\n\tt.mock.timers.enable();\n\tgetTestContext().mock.timers.reset();\n\tt.mock.timers.enable();\n});',
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', t => {\n\tgetTestContext().mock.timers.enable();\n\tt.mock.timers.reset();\n\tgetTestContext().mock.timers.enable();\n});',

		// `{skip: 0}` really does skip, so the body never runs and is not analyzed
		withImport('test(\'a\', {skip: 0}, () => { mock.timers.enable(); mock.timers.enable(); });'),
		withImport('test(\'a\', {skip: \'\'}, () => { mock.timers.enable(); mock.timers.enable(); });'),
	],
	invalid: [
		// A standalone `only` with no skip does run
		`${withNamedImport('only')}\nonly('t', () => { mock.timers.enable(); mock.timers.enable(); });`,
		`${withNamedImport('only')}\nonly({name: 't', fn() { mock.timers.enable(); mock.timers.enable(); }});`,
		// `only` does run, so a duplicate enable there is still a real problem
		`${withNamedImport('only')}\nonly('title', () => { mock.timers.enable(); mock.timers.enable(); });`,

		// A `todo` test still runs its body, so a duplicate enable in one is a real problem
		`${withNamedImport('todo')}\ntodo('title', () => { mock.timers.enable(); mock.timers.enable(); });`,
		withImport('test.todo("title", t => { t.mock.timers.enable(); t.mock.timers.enable(); });'),

		// The global tracker and a context tracker share one `Date` mock, so enabling through the
		// other receiver while one is enabled throws. A `reset()` only clears its own receiver.
		withImport('test("title", t => { mock.timers.enable(); t.mock.timers.enable(); });'),
		withImport('test("title", t => { t.mock.timers.enable(); mock.timers.enable(); });'),
		withImport('test("title", t => { mock.timers.enable(); t.mock.timers.reset(); t.mock.timers.enable(); });'),
		withImport('test("title", t => { t.mock.timers.enable(); mock.timers.reset(); t.mock.timers.enable(); });'),
		withImport('test("title", t => { t.mock.timers.enable(); mock.timers.reset(); mock.timers.enable(); });'),
		'import {test, mock, getTestContext} from \'node:test\';\ntest(\'a\', t => {\n\tgetTestContext().mock.timers.enable();\n\tmock.timers.enable();\n});',

		// Global mock tracker.
		withImport('mock.timers.enable();\nmock.timers.enable();'),
		// A class static block is module-level code, so the same duplicate applies there
		withImport('class A {\n\tstatic {\n\t\tmock.timers.enable();\n\t\tmock.timers.enable();\n\t}\n}'),
		withImport('mock.timers.enable();\ntest.mock.timers.enable();'),
		withImport('mock.timers.enable();\nmock.timers.enable();\nmock.timers.enable();'),

		// Default and namespace forms refer to the same global tracker.
		'import test from \'node:test\';\ntest.mock.timers.enable();\ntest.mock.timers.enable();',
		'import * as nodeTest from \'node:test\';\nnodeTest.mock.timers.enable();\nnodeTest.mock.timers.enable();',
		'import {mock as tracker} from \'node:test\';\ntracker.timers.enable();\ntracker.timers.enable();',
		'import {describe, mock} from \'node:test\';\ndescribe("title", () => { mock.timers.enable(); mock.timers.enable(); });',
		'import {describe, mock} from \'node:test\';\ndescribe.todo("title", () => { mock.timers.enable(); mock.timers.enable(); });',
		'import {suite, mock} from \'node:test\';\nsuite("title", () => { mock.timers.enable(); mock.timers.enable(); });',
		'import test, {mock} from \'node:test\';\nfoo.skip(() => { test("title", () => { mock.timers.enable(); mock.timers.enable(); }); });',

		// Context mock tracker.
		withImport('test("title", t => { t.mock.timers.enable(); t.mock.timers.enable(); });'),
		withImport('test("parent", t => { t.test("child", child => { child.mock.timers.enable(); child.mock.timers.enable(); }); });'),
		withImport('test("title", (t = undefined) => { t.mock.timers.enable(); t.mock.timers.enable(); });'),
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.mock.timers.enable(); t.mock.timers.enable(); });',
		// A trailing object after the callback is not the options slot, so the test still runs
		'import {test} from \'node:test\';\ntest("title", t => { t.mock.timers.enable(); t.mock.timers.enable(); }, {skip: true});',
		'import {beforeEach} from \'node:test\';\nbeforeEach((t = undefined) => { t.mock.timers.enable(); t.mock.timers.enable(); });',
		withImport('test("title", t => { t.beforeEach(hookContext => { hookContext.mock.timers.enable(); hookContext.mock.timers.enable(); }); });'),
		// A top-level hook body is a tracked path of its own, with the global tracker
		'import {beforeEach, mock} from \'node:test\';\nbeforeEach(() => { mock.timers.enable(); mock.timers.enable(); });',
		withImport('test("title", t => { t.beforeEach((hookContext = undefined) => { hookContext.mock.timers.enable(); hookContext.mock.timers.enable(); }); });'),
		withImport([
			'test("title", t => {',
			't.before(hookContext => { hookContext.mock.timers.enable(); hookContext.mock.timers.enable(); });',
			't.after(hookContext => { hookContext.mock.timers.enable(); hookContext.mock.timers.enable(); });',
			't.afterEach(hookContext => { hookContext.mock.timers.enable(); hookContext.mock.timers.enable(); });',
			'});',
		].join('\n')),

		// A conditional reset leaves a path with timers enabled.
		withImport('mock.timers.enable();\nif (condition) { mock.timers.reset(); }\nmock.timers.enable();'),
		withImport('mock.timers.enable();\nmock.restoreAll();\nmock.timers.enable();'),

		// TypeScript wrappers around the receiver.
		{
			code: withImport('test("title", (t: any) => { (t.mock as any).timers.enable(); (t.mock as any).timers.enable(); });'),
			languageOptions: {parser: parsers.typescript},
		},
		// A TypeScript wrapper on the `timers` object or on the `enable` callee must not hide the call
		{
			code: withImport('test("title", (t: any) => { (t.mock.timers as any).enable(); (t.mock.timers as any).enable(); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('test("title", (t: any) => { t.mock.timers.enable!(); t.mock.timers.enable!(); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// `getTestContext()` names the same tracker as the context parameter
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', () => { getTestContext().mock.timers.enable(); getTestContext().mock.timers.enable(); });',
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', t => { getTestContext().mock.timers.enable(); t.mock.timers.enable(); });',
		// A suite callback declares no context parameter, so both `getTestContext()` calls still name
		// the one tracker they share
		'import {describe, getTestContext} from \'node:test\';\ndescribe(\'a\', () => { getTestContext().mock.timers.enable(); getTestContext().mock.timers.enable(); });',
	],
});

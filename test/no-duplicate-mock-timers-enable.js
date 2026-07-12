import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test, {mock} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file.
		'mock.timers.enable();\nmock.timers.enable();',

		// One enable per tracker.
		withImport('mock.timers.enable();'),
		withImport('test("first", t => { t.mock.timers.enable(); });\ntest("second", t => { t.mock.timers.enable(); });'),
		withImport('test("parent", async t => { await t.test("first", child => { child.mock.timers.enable(); }); await t.test("second", child => { child.mock.timers.enable(); }); });'),
		withImport('test.skip("title", t => { t.mock.timers.enable(); t.mock.timers.enable(); });'),
		withImport('test("title", {skip: true}, t => { t.mock.timers.enable(); t.mock.timers.enable(); });'),
		withImport('test.skip("parent", t => { t.test("child", child => { child.mock.timers.enable(); child.mock.timers.enable(); }); });'),
		withImport('test.skip("title", t => { t.beforeEach(hookContext => { hookContext.mock.timers.enable(); hookContext.mock.timers.enable(); }); });'),
		'import {describe, mock} from \'node:test\';\ndescribe.skip("title", () => { mock.timers.enable(); mock.timers.enable(); });',

		// Resets permit another enable.
		withImport('mock.timers.enable();\nmock.timers.reset();\nmock.timers.enable();'),
		withImport('mock.timers.enable();\nmock.reset();\nmock.timers.enable();'),
		withImport('test("title", t => { t.mock.timers.enable(); t.mock.reset(); t.mock.timers.enable(); });'),
		'import {mock as tracker} from \'node:test\';\ntracker.timers.enable();\ntracker.reset();\ntracker.timers.enable();',

		// A reset that runs on every path clears the tracked state.
		withImport('mock.timers.enable();\nif (condition) { mock.timers.reset(); } else { mock.reset(); }\nmock.timers.enable();'),
		withImport('mock.timers.enable();\ntry { callback(); } finally { mock.timers.reset(); }\nmock.timers.enable();'),

		// Unsupported aliases, destructuring, computed properties, optional calls, helper functions, and repeated loop iterations.
		withImport('const timers = mock.timers;\ntimers.enable();\ntimers.enable();'),
		withImport('const {timers} = mock;\ntimers.enable();\ntimers.enable();'),
		withImport('mock.timers["enable"]();\nmock.timers.enable();'),
		withImport('mock.timers.enable?.();\nmock.timers.enable();'),
		withImport('function enableTimers() { mock.timers.enable(); }\nenableTimers();\nenableTimers();'),
		withImport('for (const value of values) { mock.timers.enable(); }'),
		'import {describe, mock} from \'node:test\';\ndescribe.unknown("title", () => { mock.timers.enable(); mock.timers.enable(); });',

		// TypeScript wrappers around the receiver.
		{
			code: withImport('test("title", (t: any) => { (t.mock as any).timers.enable(); (t.mock as any).timers.reset(); (t.mock as any).timers.enable(); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Global mock tracker.
		withImport('mock.timers.enable();\nmock.timers.enable();'),
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
		'import {beforeEach} from \'node:test\';\nbeforeEach((t = undefined) => { t.mock.timers.enable(); t.mock.timers.enable(); });',
		withImport('test("title", t => { t.beforeEach(hookContext => { hookContext.mock.timers.enable(); hookContext.mock.timers.enable(); }); });'),
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
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test, {mock, beforeEach} from 'node:test';
${code}`;

test.snapshot({
	valid: [
		// Not a test file
		't.mock.timers.enable({apis: [\'setTimeout\']});',

		// External implementation
		'import test from \'node:test\';\ntest(\'title\', implementation);',

		// Shadowed imported test functions are not node:test scopes
		'import {test} from \'node:test\';\n{ const test = implementation; test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); }); }',

		// Non-mock local object
		'import test from \'node:test\';\ntest(\'title\', () => { const mock = {timers: {enable() {}}}; mock.timers.enable(); });',
		withImport('test(\'title\', () => { const mock = {timers: {enable() {}}}; mock.timers.enable(); });'),
		withImport('test(\'title\', t => { { const t = {mock: {timers: {enable() {}}}}; t.mock.timers.enable(); } });'),
		withImport('test(\'title\', () => { t.mock.timers.enable({apis: [\'setTimeout\']}); });'),

		// Context mock advanced with tick()
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); setTimeout(callback, 100); t.mock.timers.tick(100); });'),
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setInterval\']}); setInterval(callback, 50); t.mock.timers.tick(50); t.mock.timers.tick(50); });'),

		// Context mock advanced with runAll()
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setImmediate\']}); setImmediate(callback); t.mock.timers.runAll(); });'),

		// Date-only mocks do not need advancement
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'Date\'], now: 100}); assert.equal(getCurrentTime(), 100); });'),
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'Date\'], now: 100}); });'),

		// Explicitly enabling no APIs is a no-op
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: []}); });'),

		// Only the enabled list matters, so a spread that comes before it does not hide it
		withImport('test(\'title\', t => { t.mock.timers.enable({...config, apis: [\'Date\']}); Date.now(); });'),
		// A computed `apis` key is still that key
		withImport('test(\'title\', t => { t.mock.timers.enable({\'apis\': [\'Date\']}); Date.now(); });'),

		// The rule only looks inside a test, hook, or subtest callback, so a module-level enable
		// has no callback to be followed by an advance
		withImport('mock.timers.enable({apis: [\'setTimeout\']});'),

		// One later advance satisfies every earlier enable; the rule does not pair them up
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); t.mock.timers.enable({apis: [\'setImmediate\']}); t.mock.timers.tick(1); });'),

		// The analysis is source order only: it does not prove an advance is reachable
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); if (condition) { t.mock.timers.tick(1); } });'),
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); try { work(); } finally { t.mock.timers.tick(1); } });'),

		// A computed subtest call is not a context call, so the subtest body is not a scope
		withImport('test(\'title\', t => { t[\'test\'](\'inner\', inner => { inner.mock.timers.enable({apis: [\'setTimeout\']}); }); });'),

		// Global mock forms
		withImport('test(\'title\', () => { mock.timers.enable({apis: [\'setTimeout\']}); mock.timers.runAll(); });'),
		withImport('test(\'title\', () => { mock.timers.enable({apis: [\'setTimeout\']}); test.mock.timers.tick(100); });'),
		withImport('test(\'title\', () => { test.mock.timers.enable({apis: [\'setTimeout\']}); test.mock.timers.tick(100); });'),
		'import {test} from \'node:test\';\ntest(\'title\', () => { test.mock.timers.enable({apis: [\'setTimeout\']}); test.mock.timers.tick(100); });',
		'import {it} from \'node:test\';\nit(\'title\', () => { it.mock.timers.enable({apis: [\'setTimeout\']}); it.mock.timers.tick(100); });',
		'import {test, mock as tracker} from \'node:test\';\ntest(\'title\', () => { tracker.timers.enable({apis: [\'setTimeout\']}); tracker.timers.tick(100); });',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'title\', () => { nodeTest.mock.timers.enable({apis: [\'setTimeout\']}); nodeTest.mock.timers.runAll(); });',

		// Hook and subtest scopes
		withImport('beforeEach(t => { t.mock.timers.enable({apis: [\'Date\']}); Date.now(); });'),
		withImport('test(\'outer\', t => { t.test(\'inner\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); t.mock.timers.tick(100); }); });'),
		withImport('test(\'title\', t => { t.beforeEach(() => { t.mock.timers.enable({apis: [\'setTimeout\']}); t.mock.timers.tick(100); }); });'),

		// Nested helper function bodies are intentionally ignored
		withImport('test(\'title\', t => { function helper() { t.mock.timers.enable({apis: [\'setTimeout\']}); } });'),
		'import {test} from \'node:test\';\ntest(\'title\', () => { test.mock.fn(() => { test.mock.timers.enable({apis: [\'setTimeout\']}); }); });',

		// Shadowed context receivers are not subtest scopes
		withImport('test(\'title\', t => { { const t = {test() {}}; t.test(\'inner\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); }); } });'),

		// Optional chaining is intentionally ignored
		withImport('test(\'title\', t => { t.mock.timers?.enable({apis: [\'setTimeout\']}); });'),

		// TypeScript wrappers around static Date-only APIs
		{
			code: withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'Date\'] as const}); Date.now(); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('test(\'title\', t => { t.mock.timers.enable({apis: <const>[\'Date\']}); Date.now(); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'Date\'] satisfies Array<\'Date\'>}); Date.now(); });'),
			languageOptions: {parser: parsers.typescript},
		},
		// `getTestContext()` is the same context, so either form advances the other\'s enable
		'import {test, getTestContext} from \'node:test\';\n'
		+ 'test(\'a\', () => { getTestContext().mock.timers.enable({apis: [\'setTimeout\']});\n'
		+ '\tsetTimeout(fn, 1);\n\tgetTestContext().mock.timers.tick(1); });',
		'import {test, getTestContext} from \'node:test\';\n'
		+ 'test(\'a\', () => { getTestContext().test(\'c\', x => { x.mock.timers.enable({apis: [\'setTimeout\']});\n'
		+ '\tsetTimeout(fn, 1);\tx.mock.timers.tick(1); }); });',
		// An unrelated object\'s `test` call is not a context call
		'import {test, getTestContext} from \'node:test\';\n'
		+ 'test(\'a\', () => { getTestContext().test(\'c\', x => {});\n'
		+ '\tother.test(\'d\', y => { y.mock.timers.enable({apis: [\'setTimeout\']});\n\tsetTimeout(fn, 1); }); });',
		'import {test, getTestContext} from \'node:test\';\n'
		+ 'test(\'a\', t => { getTestContext().mock.timers.enable({apis: [\'setTimeout\']});\n'
		+ '\tsetTimeout(fn, 1);\n\tt.mock.timers.tick(1); });',
		'import {test, getTestContext} from \'node:test\';\n'
		+ 'test(\'a\', t => { t.mock.timers.enable({apis: [\'setTimeout\']});\n'
		+ '\tsetTimeout(fn, 1);\n\tgetTestContext().mock.timers.runAll(); });',
		// A TypeScript wrapper on the advance call satisfies the enable just the same
		{
			code: 'import {test} from \'node:test\';\n'
				+ 'test(\'a\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); setTimeout(fn, 1); t.mock.timers.tick!(1); });',
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// A `getTestContext()` subtest or context hook opens a scope of its own, whatever the
		// enclosing test declared
		'import {test, getTestContext} from \'node:test\';\n'
		+ 'test(\'a\', () => { getTestContext().test(\'c\', x => { x.mock.timers.enable({apis: [\'setTimeout\']});\n'
		+ '\tsetTimeout(fn, 1); }); });',
		'import {test, getTestContext} from \'node:test\';\n'
		+ 'test(\'a\', () => { getTestContext().beforeEach(x => { x.mock.timers.enable({apis: [\'setTimeout\']});\n'
		+ '\tsetTimeout(fn, 1); }); });',
		// Timer enabled but never advanced
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); setTimeout(callback, 100); });'),

		// Default enable() includes timer APIs
		withImport('test(\'title\', t => { t.mock.timers.enable(); });'),
		withImport('test(\'title\', t => { t.mock.timers.enable({now: 100}); });'),

		// Date reads do not satisfy timer APIs
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\', \'Date\'], now: 100}); Date.now(); });'),

		// Calling setTime() does not run pending timers
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); t.mock.timers.setTime(100); });'),

		// Only later advancement satisfies the rule
		withImport('test(\'title\', t => { t.mock.timers.tick(100); t.mock.timers.enable({apis: [\'setTimeout\']}); });'),

		// Calls inside enable() arguments do not count as later usage
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\'], now: t.mock.timers.tick(1)}); });'),
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\'], now: t.mock.timers.runAll()}); });'),
		// The other way round, an enable nested in the advance's arguments is not advanced either
		withImport('test(\'title\', t => { t.mock.timers.tick(t.mock.timers.enable({apis: [\'setTimeout\']})); });'),

		// Dynamic or overridden apis are treated as timer APIs
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'Date\'], apis: [\'setTimeout\']}); Date.now(); });'),
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'Date\'], ...options}); Date.now(); });'),
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'Date\'], [apiName]: [\'setTimeout\']}); Date.now(); });'),
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: enabledApis}); });'),
		// A list that is only partly known proves nothing, so it is treated as timer APIs
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'Date\', extraApi]}); Date.now(); });'),

		// The object descriptor form is a test scope too
		withImport('test({name: \'title\', fn(t) { t.mock.timers.enable({apis: [\'setTimeout\']}); }});'),

		// A subtest has a tracker of its own, so its advance does not advance the parent's timers
		withImport('test(\'outer\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); t.test(\'inner\', t => { t.mock.timers.tick(1); }); });'),

		// Global mock forms
		withImport('test(\'title\', () => { mock.timers.enable({apis: [\'setTimeout\']}); });'),
		'import {test} from \'node:test\';\ntest(\'title\', () => { test.mock.timers.enable({apis: [\'setTimeout\']}); });',
		'import {it} from \'node:test\';\nit(\'title\', () => { it.mock.timers.enable({apis: [\'setTimeout\']}); });',
		'import {test, mock as tracker} from \'node:test\';\ntest(\'title\', () => { tracker.timers.enable({apis: [\'setTimeout\']}); });',
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'title\', () => { nodeTest.mock.timers.enable({apis: [\'setTimeout\']}); });',

		// Shadowed receivers do not satisfy imported/context mock timers
		withImport('test(\'title\', () => { mock.timers.enable({apis: [\'setTimeout\']}); { const mock = {timers: {tick() {}}}; mock.timers.tick(100); } });'),
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); { const t = {mock: {timers: {tick() {}}}}; t.mock.timers.tick(100); } });'),
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); mock.timers.tick(100); });'),

		// Hook and subtest scopes
		withImport('beforeEach(t => { t.mock.timers.enable({apis: [\'setTimeout\']}); });'),
		withImport('test(\'outer\', t => { t.test(\'inner\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); }); });'),
		withImport('test(\'title\', t => { t.beforeEach(() => { t.mock.timers.enable({apis: [\'setTimeout\']}); }); });'),

		// Nested helper function bodies do not satisfy the enclosing test
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); function helper() { t.mock.timers.tick(100); } });'),

		// TypeScript
		{
			code: withImport('test(\'title\', (t: TestContext) => { t.mock.timers.enable({apis: [\'setImmediate\']}); });'),
			languageOptions: {parser: parsers.typescript},
		},
		// A TypeScript-wrapped `t.mock.timers` receiver still needs a tick.
		{
			code: withImport('test(\'title\', (t: any) => { (t.mock.timers as any).enable({apis: [\'setTimeout\']}); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('test(\'title\', (t: any) => { (t.mock as any).timers.enable({apis: [\'setTimeout\']}); });'),
			languageOptions: {parser: parsers.typescript},
		},
		// A defaulted context parameter is still the test context.
		withImport('test(\'title\', (t = getTestContext()) => { t.mock.timers.enable({apis: [\'setTimeout\']}); });'),

		// `getTestContext()` is the same context, whether or not the callback declares a parameter
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', () => { getTestContext().mock.timers.enable({apis: [\'setTimeout\']}); setTimeout(fn, 1); });',
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', t => { getTestContext().mock.timers.enable({apis: [\'setTimeout\']}); setTimeout(fn, 1); });',
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', t => { t.mock.timers.enable({apis: [\'setTimeout\']}); setTimeout(fn, 1); });',

		// A TypeScript wrapper on the callee must not hide the call
		{
			code: 'import {test} from \'node:test\';\n'
				+ 'test(\'a\', t => { t.mock.timers.enable!({apis: [\'setTimeout\']}); setTimeout(fn, 1); });',
			languageOptions: {parser: parsers.typescript},
		},

		// A TypeScript `this` parameter is erased at compile time, so `t` is the context
		{
			code: withImport('test(\'a\', (this: void, t) => { t.mock.timers.enable({apis: [\'setTimeout\']}); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

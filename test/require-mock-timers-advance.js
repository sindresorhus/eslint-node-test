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
	],
	invalid: [
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

		// Dynamic or overridden apis are treated as timer APIs
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'Date\'], apis: [\'setTimeout\']}); Date.now(); });'),
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'Date\'], ...options}); Date.now(); });'),
		withImport('test(\'title\', t => { t.mock.timers.enable({apis: [\'Date\'], [apiName]: [\'setTimeout\']}); Date.now(); });'),

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
	],
});

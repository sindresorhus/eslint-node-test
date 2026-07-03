import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const head = 'import {test, mock} from \'node:test\';\n';

test.snapshot({
	valid: [
		// Not a test file.
		'mock.timers.enable();',

		// Explicit apis.
		head + 'mock.timers.enable({apis: ["setTimeout"]});',

		// Explicit apis with other options.
		head + 'mock.timers.enable({apis: ["Date"], now: 1000});',

		// Explicitly mock no APIs.
		head + 'mock.timers.enable({apis: []});',

		// String key.
		head + 'mock.timers.enable({"apis": ["setImmediate"]});',

		// Shorthand key.
		head + 'const apis = ["setInterval"];\nmock.timers.enable({apis});',

		// Dynamic options are ignored.
		head + 'mock.timers.enable(timerOptions);',

		// Visible apis with a spread.
		head + 'mock.timers.enable({...timerOptions, apis: ["setTimeout"]});',

		// Last visible apis property wins.
		head + 'mock.timers.enable({apis: undefined, apis: ["setTimeout"]});',

		// Named test import as namespace with explicit apis.
		head + 'test.mock.timers.enable({apis: ["setTimeout"]});',

		// Context mock with explicit apis.
		head + 'test("a", t => { t.mock.timers.enable({apis: ["setTimeout"]}); });',

		// The test context parameter is not in scope before the callback body.
		head + 'test(t.mock.timers.enable(), t => {});',

		// Shadowed names are not the test context.
		head + 'test("a", t => { const fn = t => { t.mock.timers.enable(); }; });',

		// Shadowed global mock import.
		head + 'test("a", () => { const fn = mock => { mock.timers.enable(); }; });',

		// Shadowed namespace import.
		'import * as nodeTest from \'node:test\';\nnodeTest.test("a", () => { const fn = nodeTest => { nodeTest.mock.timers.enable(); }; });',

		// Shadowed test import.
		head + 'const fn = test => { test("a", t => { t.mock.timers.enable(); }); };',

		// Shadowed subtest receiver.
		head + 'test("a", t => { const fn = t => { t.test("b", subtest => { subtest.mock.timers.enable(); }); }; });',

		// Namespace mock with explicit apis.
		'import * as nodeTest from \'node:test\';\nnodeTest.mock.timers.enable({apis: ["setTimeout"]});',

		// Default import acts as both test function and namespace.
		'import test from \'node:test\';\ntest.mock.timers.enable({apis: ["setTimeout"]});',

		// Unrelated timers object.
		head + 'timers.enable();',

		// Unrelated mock-looking object outside a tracked test context.
		head + 'helper.mock.timers.enable();',

		// Unrelated test member call is not a test context.
		head + 'test.foo("a", t => { t.mock.timers.enable(); });',

		// Hook member call is not a hook context.
		'import {beforeEach} from \'node:test\';\nbeforeEach.foo(t => { t.mock.timers.enable(); });',

		// Computed property is ignored.
		head + 'mock.timers[enable]();',
	],
	invalid: [
		// No arguments.
		head + 'mock.timers.enable();',

		// Empty options object.
		head + 'mock.timers.enable({});',

		// Explicit undefined is the same as omitting the options object.
		head + 'mock.timers.enable(undefined);',

		// `void` is the same as omitting the options object.
		head + 'mock.timers.enable(void 0);',

		// Options object without apis.
		head + 'mock.timers.enable({now: 1000});',

		// Undefined apis value.
		head + 'mock.timers.enable({apis: undefined});',

		// Falsy apis values fall back to mocking every API.
		head + 'mock.timers.enable({apis: null});',
		head + 'mock.timers.enable({apis: false});',

		// Spread without an explicit apis property.
		head + 'mock.timers.enable({...timerOptions});',

		// A trailing spread can override apis.
		head + 'mock.timers.enable({apis: ["setTimeout"], ...timerOptions});',

		// The last visible apis property wins.
		head + 'mock.timers.enable({apis: ["setTimeout"], apis: undefined});',

		// Context mock.
		head + 'test("a", t => { t.mock.timers.enable(); });',

		// `it` context mock.
		'import {it} from \'node:test\';\nit("a", t => { t.mock.timers.enable(); });',

		// Context mock with a modifier.
		head + 'test.only("a", t => { t.mock.timers.enable(); });',

		// Context mock inside a nested closure.
		head + 'test("a", t => { const fn = () => { t.mock.timers.enable(); }; fn(); });',

		// Subtest context.
		head + 'test("a", t => { t.test("b", subtest => { subtest.mock.timers.enable({now: 1000}); }); });',

		// Outer context used inside a subtest.
		head + 'test("a", t => { t.test("b", subtest => { t.mock.timers.enable(); }); });',

		// Hook context.
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.mock.timers.enable(); });',

		// Namespace hook context.
		'import * as nodeTest from \'node:test\';\nnodeTest.beforeEach(t => { t.mock.timers.enable(); });',

		// Default import hook context.
		'import test from \'node:test\';\ntest.beforeEach(t => { t.mock.timers.enable(); });',

		// Namespace test call context.
		'import * as nodeTest from \'node:test\';\nnodeTest.test("a", t => { t.mock.timers.enable(); });',

		// Named test import as namespace.
		head + 'test.mock.timers.enable();',

		// Renamed it import as namespace.
		'import {it as spec} from \'node:test\';\nspec.mock.timers.enable({now: 1000});',

		// Namespace import.
		'import * as nodeTest from \'node:test\';\nnodeTest.mock.timers.enable();',

		// Default import as namespace.
		'import test from \'node:test\';\ntest.mock.timers.enable({now: 1000});',

		// Renamed mock import.
		'import {test, mock as testMock} from \'node:test\';\ntestMock.timers.enable();',

		// TypeScript wrapper.
		{
			code: head + 'mock.timers.enable(({} as {now?: number}));',
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript-wrapped undefined apis value.
		{
			code: head + 'mock.timers.enable({apis: (undefined as string[] | undefined)});',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

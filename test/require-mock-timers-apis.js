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

		// String key.
		head + 'mock.timers.enable({"apis": ["setImmediate"]});',

		// Shorthand key.
		head + 'const apis = ["setInterval"];\nmock.timers.enable({apis});',

		// Dynamic options are ignored.
		head + 'mock.timers.enable(timerOptions);',

		// Visible apis with a spread.
		head + 'mock.timers.enable({...timerOptions, apis: ["setTimeout"]});',

		// Context mock with explicit apis.
		head + 'test("a", t => { t.mock.timers.enable({apis: ["setTimeout"]}); });',

		// The test context parameter is not in scope before the callback body.
		head + 'test(t.mock.timers.enable(), t => {});',

		// Shadowed names are not the test context.
		head + 'test("a", t => { const fn = t => { t.mock.timers.enable(); }; });',

		// Shadowed global mock import.
		head + 'test("a", () => { const fn = mock => { mock.timers.enable(); }; });',

		// Shadowed namespace import.
		'import * as nodeTest from \'node:test\';\ntest("a", () => { const fn = nodeTest => { nodeTest.mock.timers.enable(); }; });',

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

		// Options object without apis.
		head + 'mock.timers.enable({now: 1000});',

		// Spread without an explicit apis property.
		head + 'mock.timers.enable({...timerOptions});',

		// Context mock.
		head + 'test("a", t => { t.mock.timers.enable(); });',

		// Context mock inside a nested closure.
		head + 'test("a", t => { const fn = () => { t.mock.timers.enable(); }; fn(); });',

		// Subtest context.
		head + 'test("a", t => { t.test("b", subtest => { subtest.mock.timers.enable({now: 1000}); }); });',

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
	],
});

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

		// Current test context with explicit apis.
		'import {test, getTestContext} from \'node:test\';\ntest("a", () => { getTestContext().mock.timers.enable({apis: ["setTimeout"]}); });',

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

		// Shadowed getTestContext import.
		'import {getTestContext} from \'node:test\';\nconst fn = getTestContext => { getTestContext().mock.timers.enable(); };',

		// Shadowed subtest receiver.
		head + 'test("a", t => { const fn = t => { t.test("b", subtest => { subtest.mock.timers.enable(); }); }; });',

		// Destructured context mock aliasing is intentionally ignored.
		'import {test} from \'node:test\';\ntest("a", t => { const {mock} = t; mock.timers.enable(); });',

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
		head + 'mock.timers.enable({apis: 0});',
		head + 'mock.timers.enable({apis: ""});',

		// Spread without an explicit apis property.
		head + 'mock.timers.enable({...timerOptions});',

		// A trailing spread can override apis.
		head + 'mock.timers.enable({apis: ["setTimeout"], ...timerOptions});',

		// The last visible apis property wins.
		head + 'mock.timers.enable({apis: ["setTimeout"], apis: undefined});',

		// Context mock.
		head + 'test("a", t => { t.mock.timers.enable(); });',

		// Defaulted context parameter.
		head + 'test("a", (t = fallback) => { t.mock.timers.enable(); });',

		// `it` context mock.
		'import {it} from \'node:test\';\nit("a", t => { t.mock.timers.enable(); });',

		// Context mock with a modifier.
		head + 'test.only("a", t => { t.mock.timers.enable(); });',

		// TypeScript-wrapped test call.
		{
			code: head + '(test as typeof test)("a", t => { t.mock.timers.enable(); });',
			languageOptions: {parser: parsers.typescript},
		},

		// Context mock inside a nested closure.
		head + 'test("a", t => { const fn = () => { t.mock.timers.enable(); }; fn(); });',

		// Subtest context.
		head + 'test("a", t => { t.test("b", subtest => { subtest.mock.timers.enable({now: 1000}); }); });',

		// TypeScript-wrapped subtest receiver.
		{
			code: head + 'test("a", t => { (t as TestContext).test("b", subtest => { subtest.mock.timers.enable(); }); });',
			languageOptions: {parser: parsers.typescript},
		},

		// Defaulted subtest context parameter.
		head + 'test("a", t => { t.test("b", (subtest = fallback) => { subtest.mock.timers.enable(); }); });',

		// Outer context used inside a subtest.
		head + 'test("a", t => { t.test("b", subtest => { t.mock.timers.enable(); }); });',

		// Current test context.
		'import {test, getTestContext} from \'node:test\';\ntest("a", () => { getTestContext().mock.timers.enable(); });',

		// Renamed current test context.
		'import {test, getTestContext as context} from \'node:test\';\ntest("a", () => { context().mock.timers.enable({now: 1000}); });',

		// Namespace current test context.
		'import * as nodeTest from \'node:test\';\nnodeTest.test("a", () => { nodeTest.getTestContext().mock.timers.enable(); });',

		// Default import current test context.
		'import test from \'node:test\';\ntest("a", () => { test.getTestContext().mock.timers.enable(); });',

		// TypeScript non-null current test context.
		{
			code: 'import {test, getTestContext} from \'node:test\';\ntest("a", () => { getTestContext()!.mock.timers.enable(); });',
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript cast current test context.
		{
			code: 'import {test, getTestContext} from \'node:test\';\ntest("a", () => { (getTestContext() as TestContext).mock.timers.enable({now: 1000}); });',
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript-wrapped global mock.
		{
			code: head + '(mock as typeof mock).timers.enable();',
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript-wrapped default test mock.
		{
			code: 'import test from \'node:test\';\n(test as typeof test).mock.timers.enable({now: 1000});',
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript-wrapped default current test context.
		{
			code: 'import test from \'node:test\';\ntest("a", () => { (test as typeof test).getTestContext().mock.timers.enable(); });',
			languageOptions: {parser: parsers.typescript},
		},

		// Hook context.
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.mock.timers.enable(); });',

		// Hook context with options.
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.mock.timers.enable(); }, {timeout: 1000});',

		// Defaulted hook context parameter.
		'import {beforeEach} from \'node:test\';\nbeforeEach((t = fallback) => { t.mock.timers.enable(); });',

		// Namespace hook context.
		'import * as nodeTest from \'node:test\';\nnodeTest.beforeEach(t => { t.mock.timers.enable(); });',

		// Default import hook context.
		'import test from \'node:test\';\ntest.beforeEach(t => { t.mock.timers.enable(); });',

		// Context hook.
		head + 'test("a", t => { t.beforeEach(hookContext => { hookContext.mock.timers.enable(); }); });',

		// TypeScript-wrapped context hook receiver.
		{
			code: head + 'test("a", t => { (t as TestContext).beforeEach(hookContext => { hookContext.mock.timers.enable(); }); });',
			languageOptions: {parser: parsers.typescript},
		},

		// Context hook with options.
		head + 'test("a", t => { t.beforeEach(hookContext => { hookContext.mock.timers.enable(); }, {timeout: 1000}); });',

		// Subtest context hook.
		head + 'test("a", t => { t.test("b", subtest => { subtest.beforeEach(hookContext => { hookContext.mock.timers.enable(); }); }); });',

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

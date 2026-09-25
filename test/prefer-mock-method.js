import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withMock = code => `import {mock} from 'node:test';\n${code}`;
const inTest = code => `import test from 'node:test';\ntest('t', t => {\n\t${code}\n});`;

test.snapshot({
	valid: [
		// Not a test file
		'object.method = mock.fn();',

		// `mock.fn()` not assigned to a property — legitimate standalone mock
		withMock('const spy = mock.fn();'),
		withMock('callApi(mock.fn());'),

		// Already using `mock.method`
		withMock('mock.method(object, \'method\');'),

		// Assigning a non-mock value
		withMock('object.method = () => {};'),

		// `mock` is not the node:test mock here
		'const mock = other;\nobject.method = mock.fn();',

		// Assigning to a plain variable, not a property
		withMock('let spy;\nspy = mock.fn();'),

		// A shadowed inner parameter with the same name is not the test context
		'import test from \'node:test\';\ntest(\'t\', t => {\n\tfunction f(t) {\n\t\tobject.method = t.mock.fn();\n\t}\n});',
	],
	invalid: [
		// A sequence-expression receiver or implementation is re-emitted without its parentheses,
		// which would turn one argument into several, so the problem is reported but not fixed.
		inTest('(getObj(), other).method = t.mock.fn();'),
		inTest('object.method = t.mock.fn((a, b));'),

		// Hook callbacks receive a real test context, so `t.mock.fn()` is trackable there too
		'import {before} from \'node:test\';\nbefore(t => { object.method = t.mock.fn(); });',
		// `getTestContext()` is the same context, so its `mock` is the context's too
		'import {test, getTestContext} from \'node:test\';\ntest(\'t\', () => { object.method = getTestContext().mock.fn(); });',
		'import {test, getTestContext} from \'node:test\';\ntest(\'t\', () => { object.method = getTestContext().mock.fn(() => 42); });',
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { object.method = t.mock.fn(); });',
		'import {after} from \'node:test\';\nafter(t => { object.method = t.mock.fn(); });',
		'import {afterEach} from \'node:test\';\nafterEach(t => { object.method = t.mock.fn(); });',
		'import test from \'node:test\';\ntest.beforeEach(t => { object.method = t.mock.fn(); });',
		'import {beforeEach} from \'node:test\';\nbeforeEach(function (t) { object.method = t.mock.fn(); });',

		// A reason in a hook context is honored the same way
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { object.method = t.mock.fn(() => 42); });',
		// Global mock assigned to a property
		withMock('object.method = mock.fn();'),

		// With an implementation argument
		withMock('object.method = mock.fn(() => 42);'),

		// Computed string key
		withMock('object[\'method\'] = mock.fn();'),
		withMock('object[`method`] = mock.fn();'),
		withMock('const name = \'method\';\nobject[name] = mock.fn();'),
		withMock('const methodName = \'method\';\nobject[methodName] = mock.fn();'),

		// `mock.method()` needs a string method name, so a computed key is only rewritten when it is
		// statically one. An unresolvable identifier may hold anything, so it gets no suggestion.
		withMock('object[methodName] = mock.fn();'),
		withMock('function f(methodName) { object[methodName] = mock.fn(); }'),
		withMock('object[0] = mock.fn();'),
		withMock('object[-1] = mock.fn();'),
		withMock('object[1.5] = mock.fn();'),
		withMock('object[true] = mock.fn();'),
		withMock('object[null] = mock.fn();'),
		withMock('object[Symbol.iterator] = mock.fn();'),

		// Nested object path
		withMock('a.b.c.run = mock.fn();'),

		// Context mock
		inTest('t.mock.fn();\nobject.method = t.mock.fn();'),

		// Context mock with implementation
		inTest('object.method = t.mock.fn(() => 42);'),

		// Named test import
		'import {test} from \'node:test\';\nobject.method = test.mock.fn();',

		// Renamed mock import
		'import {mock as m} from \'node:test\';\nobject.method = m.fn();',

		// More than one argument — reported but not rewritten
		withMock('object.method = mock.fn(original, () => 42);'),

		// Assignment value is used — reported but not rewritten, since `mock.method()` returns a
		// different value (the original method) than the assignment (the mock function).
		withMock('const spy = object.method = mock.fn();'),

		// TypeScript: a cast on the assigned value must not hide the `mock.fn()` call. The rewrite
		// drops the cast, which is correct — `mock.method()` returns the original method anyway.
		{
			code: withMock('object.method = mock.fn() as typeof object.method;'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withMock('object.method = mock.fn(() => 42) as any;'),
			languageOptions: {parser: parsers.typescript},
		},
		// TypeScript: a cast on a context mock receiver
		{
			code: inTest('object.method = t.mock.fn() as any;'),
			languageOptions: {parser: parsers.typescript},
		},

		// A sequence expression in the receiver or the implementation is re-emitted without its
		// parentheses, which would turn one argument into several, so no suggestion is offered
		inTest('(a, object).method = t.mock.fn(() => \'stubbed\');'),
		inTest('object.method = t.mock.fn((a, b));'),
		inTest('object[(a, b)] = t.mock.fn(() => \'stubbed\');'),
	],
});

import {getTester} from './utils/test.js';

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
	],
	invalid: [
		// Global mock assigned to a property
		withMock('object.method = mock.fn();'),

		// With an implementation argument
		withMock('object.method = mock.fn(() => 42);'),

		// Computed string key
		withMock('object[\'method\'] = mock.fn();'),

		// Computed dynamic key — suggestion uses the expression
		withMock('object[name] = mock.fn();'),

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
	],
});

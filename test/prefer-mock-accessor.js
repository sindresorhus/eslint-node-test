import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);
const withMock = code => `import {mock} from 'node:test';\n${code}`;
const inTest = code => `import test from 'node:test';\ntest('t', t => {\n\t${code}\n});`;

test.snapshot({
	valid: [
		// Not a test file.
		'mock.method(object, \'value\', {getter: true});',

		// No enabled accessor option.
		withMock('mock.method(object, \'method\');'),
		withMock('mock.method(object, \'value\', {getter: false});'),
		withMock('mock.method(object, \'value\', {setter: false});'),
		withMock('mock.method(object, \'value\', {getter: enabled});'),

		// A four-argument call is only unambiguous when the implementation is an inline function.
		withMock('mock.method(object, \'value\', {setter: true}, {getter: true});'),
		withMock('const implementation = {setter: true};\nmock.method(object, \'value\', implementation, {getter: true});'),
		withMock('mock.method(object, \'value\', ...[{setter: true}], {getter: true});'),

		// Incompatible accessor options are invalid in node:test.
		withMock('mock.method(object, \'value\', {getter: true, setter: true});'),
		withMock('mock.method(object, \'value\', {setter: true, getter: true});'),

		// The last accessor option wins.
		withMock('mock.method(object, \'value\', {getter: true, getter: false});'),

		// Spreads make the effective options dynamic.
		withMock('mock.method(object, \'value\', {...options, getter: true});'),
		withMock('mock.method(object, \'value\', {getter: true, ...options});'),
		withMock('mock.method(object, \'value\', {getter: true, get unrelated() { return true; }});'),
		withMock('mock.method(object, \'value\', {__proto__: {setter: true}, getter: true});'),

		// Computed option keys are intentionally ignored.
		withMock('mock.method(object, \'value\', {[\'getter\']: true});'),

		// Shadowed mock imports are ignored.
		withMock('const fn = mock => mock.method(object, \'value\', {getter: true});'),

		// The context identifier is scoped to the test callback.
		inTest('const fn = t => t.mock.method(object, \'value\', {getter: true});'),

		// A TypeScript-wrapped third object argument is still the effective options object.
		{
			code: withMock('mock.method(object, \'value\', ({setter: true} as const), {getter: true});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Global mock getter.
		withMock('mock.method(object, \'value\', {getter: true});'),
		withMock('mock.method(object, \'value\', {getter: false, getter: true});'),
		withMock('mock?.method?.(object, \'value\', {getter: true});'),
		withMock('(mock?.method)?.(object, \'value\', {getter: true});'),
		withMock('mock.method(object, \'value\', {getter: true, setter: false});'),
		withMock('mock.method(object, \'value\', {getter: false, setter: true});'),

		// Global mock setter with a quoted option key.
		withMock('mock.method(object, \'value\', {\'setter\': true});'),

		// An implementation and other options are preserved.
		withMock('mock.method(object, \'value\', () => 42, {getter: true, times: 2});'),
		{
			code: withMock('mock.method(object, \'value\', (() => 42) as () => number, {getter: true});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withMock('((mock as any)?.method)?.(object, \'value\', {getter: true});'),
			languageOptions: {parser: parsers.typescript},
		},

		// The options object can be the third argument.
		withMock('mock.method(object, \'value\', {setter: true});'),

		// Renamed mock import.
		'import {mock as tracker} from \'node:test\';\ntracker.method(object, \'value\', {getter: true});',

		// Namespace mock.
		'import * as nodeTest from \'node:test\';\nnodeTest.mock.method(object, \'value\', {setter: true});',

		// Default import as the node:test namespace.
		'import test from \'node:test\';\ntest.mock.method(object, \'value\', {getter: true});',

		// Test context mock.
		inTest('t.mock.method(object, \'value\', {setter: true});'),
		inTest('t.test(\'child\', child => child.mock.method(object, \'value\', {getter: true}));'),
		{
			code: 'import test from \'node:test\';\ntest(\'t\', (t => { t.mock.method(object, \'value\', {getter: true}); }) as (t: unknown) => void);',
			languageOptions: {parser: parsers.typescript},
		},

		// Imported hook context mock.
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => t.mock.method(object, \'value\', {getter: true}));',

		// Test context hook mock.
		inTest('t.beforeEach(hookContext => hookContext.mock.method(object, \'value\', {setter: true}));'),

		// Comments in the options object are preserved.
		withMock('mock.method(object, \'value\', {\n\t/* Accessor */\n\tgetter: true,\n});'),

		// TypeScript wrappers around an options object.
		{
			code: withMock('mock.method(object, \'value\', ({getter: true} as const));'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withMock('mock.method(object, \'value\', {setter: true as const});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

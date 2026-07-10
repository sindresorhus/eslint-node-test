import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withNodeTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a `node:test` file.
		'spy.mock.calls.length;',

		// Already using `callCount()`.
		withNodeTest('spy.mock.callCount();'),

		// Reading a call record is not a call-count check.
		withNodeTest('spy.mock.calls[0];'),

		// Property mocks use `accessCount()` instead.
		withNodeTest('spy.mock.accesses.length;'),

		// Computed and optional access are deliberately unsupported.
		withNodeTest('spy.mock[\'calls\'].length;'),
		withNodeTest('spy.mock.calls?.length;'),
		withNodeTest('spy.mock?.calls.length;'),
		withNodeTest('spy?.mock.calls.length;'),

		// A call count is read-only.
		withNodeTest('spy.mock.calls.length = 1;'),
		withNodeTest('spy.mock.calls.length++;'),
		withNodeTest('delete spy.mock.calls.length;'),
		withNodeTest('([spy.mock.calls.length] = values);'),
		withNodeTest('([spy.mock.calls.length = 1] = values);'),
		withNodeTest('({length: spy.mock.calls.length} = value);'),
		withNodeTest('for (spy.mock.calls.length in object) {}'),
		withNodeTest('for (spy.mock.calls.length of values) {}'),
		withNodeTest('for ([spy.mock.calls.length] of values) {}'),
		withNodeTest('for ({length: spy.mock.calls.length} of values) {}'),

		// TypeScript wrappers are outside the direct member-chain match.
		{
			code: withNodeTest('(spy.mock.calls as unknown[]).length;'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withNodeTest('spy.mock.calls!.length;'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withNodeTest('(<unknown[]>spy.mock.calls).length;'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withNodeTest('(spy.mock.calls satisfies unknown[]).length;'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withNodeTest('([spy.mock.calls.length as number] = values);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withNodeTest('(spy.mock.calls.length as number) = 1;'),
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Mock function.
		withNodeTest('const spy = test.mock.fn();\nassert.equal(spy.mock.calls.length, 1);'),

		// Mocked object method.
		withNodeTest('object.method.mock.calls.length;'),

		// The expression can be part of a longer chain.
		withNodeTest('String(spy.mock.calls.length);'),

		// Parentheses around the calls collection are supported.
		withNodeTest('(spy.mock.calls).length;'),

		// This rule intentionally uses the structural match in `node:test` files.
		withNodeTest('const fake = {mock: {calls: []}};\nfake.mock.calls.length;'),

		// Report without removing comments.
		withNodeTest('spy.mock /* comment */ .calls.length;'),
	],
});

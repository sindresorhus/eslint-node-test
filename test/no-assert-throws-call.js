import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withNamespaceAssert = code => `import * as assert from 'node:assert';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;
const withNamedStrictImport = (methods, code) => `import {${methods}} from 'node:assert/strict';\n${code}`;
const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import, ignored
		'assert.throws(parse(input));',

		// Correct callback forms
		withAssert('assert.throws(() => parse(input));'),
		withAssert('assert.throws(function () { parse(input); });'),
		withAssert('assert.throws(callback);'),
		withStrictAssert('assert.throws(() => parse(input));'),

		// Other assertions are unaffected
		withAssert('assert.rejects(parseAsync(input));'),
		withAssert('assert.doesNotThrow(parse(input));'),
		withAssert('assert.ok(parse(input));'),

		// Spread arguments are not statically known
		withAssert('assert.throws(...args);'),

		// Obvious function-producing calls
		withAssert('assert.throws(fn.bind(undefined, input));'),
		withAssert('assert.throws(Function(\'throw new Error()\'));'),

		// TypeScript callback expression
		{
			code: withAssert('assert.throws((() => parse(input)) as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},

		// `.assert.throws` on a non-context object — not a test context
		withAssert('const custom = {assert: {throws() {}}};\ncustom.assert.throws(parse(input));'),
	],
	invalid: [
		withAssert('assert.throws(parse(input));'),
		withAssert('assert.throws(parser.parse(input), SyntaxError);'),
		withStrictAssert('assert.throws(parse(input));'),
		withNamespaceAssert('assert.throws(parse(input));'),
		withAssert('assert.strict.throws(parse(input));'),
		withNamedImport('throws', 'throws(parse(input));'),
		withNamedImport('throws as assertThrows', 'assertThrows(parse(input));'),
		withNamedImport('strict as strictAssert', 'strictAssert.throws(parse(input));'),
		withNamedStrictImport('throws', 'throws(parse(input));'),
		withTest('test(\'t\', t => { t.assert.throws(parse(input)); });'),
		withAssert('assert.throws(/* comment */ parse(input), SyntaxError);'),
		withAssert('assert.throws((parse(input)));'),
		withAssert('assert.throws(parse?.(input));'),
		{
			code: withAssert('assert.throws(parse(input) as never);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws(parse(input)!);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws(parse(input) satisfies never);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

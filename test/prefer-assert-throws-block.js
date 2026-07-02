import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withBareAssert = code => `import assert from 'assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withNamespaceAssert = code => `import * as assert from 'node:assert';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;
const withStrictNamedImport = (methods, code) => `import {${methods}} from 'node:assert/strict';\n${code}`;
const withTest = code => `import test from 'node:test';\n${code}`;
const withTestAndAssert = code => `import test from 'node:test';\nimport assert from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import, ignored
		'assert.throws(() => parse(input));',

		// Unrelated calls are ignored even in an assert file
		withAssert('customAssert.throws(() => parse(input));'),

		// Shadowed assert imports are ignored
		withAssert('function run(assert) {\n\tassert.throws(() => parse(input));\n}'),
		withNamespaceAssert('function run(assert) {\n\tassert.throws(() => parse(input));\n}'),
		withNamedImport('throws', 'function run(throws) {\n\tthrows(() => parse(input));\n}'),

		// Only real test context `t.assert` calls are matched
		withTest('test(\'t\', t => {\n\thelper.assert.throws(() => parse(input));\n});'),
		withTest('test(\'t\', t => {\n\tfunction run(t) {\n\t\tt.assert.throws(() => parse(input));\n\t}\n});'),

		// Existing block callbacks are fine, even when written on one line
		withAssert('assert.throws(() => { parse(input); });'),
		withAssert('assert.throws(() => {\n\tparse(input);\n});'),

		// Non-arrow callback forms are unaffected
		withAssert('assert.throws(function () { parse(input); });'),
		withAssert('assert.throws(callback);'),

		// Other assertions are unaffected
		withAssert('assert.rejects(() => parseAsync(input));'),
		withAssert('assert.doesNotThrow(() => parse(input));'),
		withAssert('assert.doesNotReject(() => parseAsync(input));'),
		withAssert('assert.ok(() => parse(input));'),

		// Already block-bodied through a TypeScript expression wrapper
		{
			code: withAssert('assert.throws((() => { parse(input); }) as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		withAssert('assert.throws(() => parse(input));'),
		withAssert('assert.throws(() => parse(input), SyntaxError);'),
		withTestAndAssert('test(\'nested\', () => {\n\tassert.throws(() => parse(input), SyntaxError);\n});'),
		withStrictAssert('assert.throws(() => parse(input));'),
		withNamespaceAssert('assert.throws(() => parse(input));'),
		withBareAssert('assert.throws(() => parse(input));'),
		withNamedImport('throws', 'throws(() => parse(input));'),
		withStrictNamedImport('throws', 'throws(() => parse(input));'),
		withNamedImport('throws as assertThrows', 'assertThrows(() => parse(input));'),
		withTest('test(\'t\', t => {\n\tt.assert.throws(() => parse(input));\n});'),
		withAssert('assert.throws(async () => parseAsync(input));'),
		withAssert('assert.throws(() => parse?.(input));'),
		withAssert('assert.throws(() => /* comment */ parse(input));'),
		withAssert('assert.throws(() => // comment\nparse(input));'),
		withAssert('assert.throws(() => (parse(input) // comment\n), SyntaxError);'),
		withAssert('assert.throws(() => parse(input) /* comment */, SyntaxError);'),
		withAssert('assert.throws(() => parse(input) // comment\n, SyntaxError);'),
		withAssert('assert.throws(() => ({message: "boom"}));'),
		withAssert('assert.throws(() => function () {});'),
		withAssert('assert.throws(() => class {});'),
		withAssert('assert.throws(() => ({value} = object));'),
		{
			code: withAssert('assert.throws((): void => parse(input));'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws((): string => parse(input));'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws(<T>() => parse(input));'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws(() => parse(input) as never);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws(() => function () {} as Function);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws(() => class {} as typeof Error);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws((() => parse(input)) as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws((() => parse(input))!);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws((() => parse(input)) satisfies () => void);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

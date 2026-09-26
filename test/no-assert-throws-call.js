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
		withAssert('assert.throws(new Function(\'throw new Error()\'));'),

		// An argument that only reads a value runs nothing
		withAssert('assert.throws(flag ? callback : other);'),
		withAssert('assert.throws(object.method);'),
		withAssert('assert.throws(object[key]);'),
		// A parenthesized optional chain wraps the callee in a `ChainExpression`, which must not hide
		// the same `.bind` call
		withAssert('assert.throws((parse?.bind)(null), SyntaxError);'),
		withAssert('assert.throws((fn.bind)(undefined, input));'),

		// TypeScript callback expression
		{
			code: withAssert('assert.throws((() => parse(input)) as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},

		// A nested function body is a separate evaluation, so an `await` inside one is not the
		// argument's own work
		withAssert('assert.throws(async () => { await parse(input); });'),
		// An `await` with no call in it runs nothing either
		withAssert('async function run() {\n\tassert.throws(await maybeCallback);\n}'),
		// Only the first argument is analyzed: the rule is about the function handed to the assertion
		withAssert('assert.throws(callback, buildValidator());'),

		// `.assert.throws` on a non-context object — not a test context
		withAssert('const custom = {assert: {throws() {}}};\ncustom.assert.throws(parse(input));'),
	],
	invalid: [
		// Whatever the argument does while it is evaluated escapes the assertion, not just a
		// top-level call
		withAssert('assert.throws(new Parser(input));'),
		withAssert('assert.throws(new Parser(input), SyntaxError);'),
		withAssert('assert.throws(tag`input`);'),
		withAssert('assert.throws(flag ? parse(a) : parse(b));'),
		withAssert('assert.throws(flag && parse(input));'),
		withAssert('assert.throws((before(), parse(input)));'),
		withAssert('assert.throws(parse(input)());'),
		withAssert('async function run() {\n\tassert.throws(await getCallback());\n}'),
		withAssert('function* generate() {\n\tassert.throws(yield getCallback());\n}'),
		withAssert('assert.throws(object.parse(input));'),
		{
			code: withAssert('assert.throws(new Parser(input) as unknown);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws(parse(input)!);'),
			languageOptions: {parser: parsers.typescript},
		},

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
		// A `getTestContext()` receiver is a test context
		'import {getTestContext} from \'node:test\';\ngetTestContext().assert.throws(parse(input));',
		{
			code: withTest('test(\'t\', t => { (t as Context).assert.throws(parse(input)); });'),
			languageOptions: {parser: parsers.typescript},
		},
		// The factory itself has to run, so a `.bind()` whose receiver is a call is still work
		withAssert('assert.throws(getFn().bind(null));'),
		// A comment inside the argument survives the suggestion
		withAssert('assert.throws(parse(/* keep */ input));'),
		// An `await` anywhere in the argument makes the suggested arrow async
		withAssert('async function run() {\n\tassert.throws(check(await getCallback()));\n}'),
	],
});

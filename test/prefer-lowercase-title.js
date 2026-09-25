import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, it, describe, suite, before} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'test("Foo", () => {});',

		// Already lowercase
		withImport('test("foo bar", () => {});'),
		withImport('describe("foo", () => {});'),

		// Title starts with a non-letter
		withImport('test("123 abc", () => {});'),
		withImport('test("[GET] /users", () => {});'),

		// Dynamic titles with no resolvable leading text
		withImport('test(title, () => {});'),
		// eslint-disable-next-line no-template-curly-in-string
		withImport('test(`${prefix} bar`, () => {});'),

		// Hooks have no title
		withImport('before(() => {});'),

		// Allowed prefix
		{code: withImport('test("GET /users", () => {});'), options: [{allowedPrefixes: ['GET', 'POST']}]},

		// Ignored function
		{code: withImport('describe("Foo", () => {});'), options: [{ignore: ['describe']}]},
		{code: withImport('test("Foo", () => {});'), options: [{ignore: ['test']}]},

		// A title with no leading text to judge
		withImport('test("", () => {});'),
		withImport('test(123, () => {});'),

		// `node:test` names a test after `options.name`, so the positional string is not the title
		withImport('test("UPPERCASE", {name: "lowercase"}, () => {});'),
		withImport('describe("UPPERCASE", {name: "lowercase"}, () => {});'),
		// Same, in the function-first form, where the trailing object is the options slot
		withImport('test(function inner() {}, {name: "lowercase"});'),
		// A spread after `name` could override it, so the title is not statically known
		withImport('test("lowercase", {name: "UPPERCASE", ...rest}, () => {});'),
		// A trailing object after the callback is not options, so it does not name the test
		withImport('test("lowercase", () => {}, {name: "UPPERCASE"});'),

		// The object past the callback is not the options slot, so it does not name the test
		withImport('test(\'a\', \'x\', {name: \'UPPERCASE\'});'),
		withImport('test(\'a\', fn, {name: \'UPPERCASE\'});'),

		// An options slot holding an object the rule cannot see into may carry a `name`, which wins
		// over the positional title, so the positional title is not the test's name
		'import {test} from \'node:test\';\nconst options = {name: \'lowercase\'};\ntest(\'Uppercase positional\', options, () => {});',
		'import {test} from \'node:test\';\nconst options = {name: \'lowercase\'};\ntest(\'Uppercase\', options, {skip: true}, () => {});',
		'import {test} from \'node:test\';\nconst body = () => {};\ntest(\'Uppercase\', body);',
	],
	invalid: [
		// The object form title is the descriptor's `name`
		'import test from \'node:test\';\ntest({name: \'Bad Title\', fn() {}});',

		// Uppercase first letter — test/it/describe/suite
		withImport('test("Foo", () => {});'),
		withImport('it("Should work", () => {});'),
		withImport('describe("Foo", () => {});'),
		withImport('suite("Foo", () => {});'),

		// Modifier chain
		withImport('describe.only("Foo", () => {});'),

		// Template literal with leading uppercase text
		// eslint-disable-next-line no-template-curly-in-string
		withImport('test(`Foo ${x}`, () => {});'),

		// Title with an options object still has a title
		withImport('test("Foo", {skip: true}, () => {});'),

		// Unicode uppercase letter
		withImport('test("Éfoo", () => {});'),

		// `allowedPrefixes` set but title does not match a prefix
		{code: withImport('test("Delete user", () => {});'), options: [{allowedPrefixes: ['GET']}]},

		// `ignore` set for describe but a test is still checked
		{code: withImport('test("Foo", () => {});'), options: [{ignore: ['describe']}]},
		// `ignore` names one function, so a suite title is still checked
		{code: withImport('describe("Foo", () => {});'), options: [{ignore: ['test']}]},

		// A first character written as an escape is reported, but rewriting it would corrupt the escape
		withImport(String.raw`test("\u0041bc", () => {});`),
		withImport(String.raw`test("\u{41}bc", () => {});`),

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test("Foo", () => {});',

		// TypeScript
		{
			code: withImport('test("Foo" as string, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},

		// A leading descriptor names the test even when arguments follow, which `node:test` ignores
		'import test from \'node:test\';\ntest({name: \'Bad Title\'}, () => {});',
		'import test from \'node:test\';\ntest({name: \'Bad Title\'}, {skip: true}, () => {});',

		// `options.name` is the title, so the fix rewrites it and leaves the positional string alone
		withImport('test("lowercase", {name: "UPPERCASE"}, () => {});'),
		withImport('test(function inner() {}, {name: "UPPERCASE"});'),
		// A spread before `name` cannot override it, so the title is still known
		withImport('test("lowercase", {...rest, name: "UPPERCASE"}, () => {});'),
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'Foo\', () => {}); });',
		'import {test, getTestContext} from \'node:test\';\ntest(\'p\', async () => { await getTestContext().test(\'Foo\', () => {}); });',

		// An uppercase letter outside the BMP is two UTF-16 code units, so indexing the title with
		// `[0]` sees only a lone surrogate and misses it.
		withImport('test("\u{10400}bc", () => {});'),
		// No lowercase form exists for this one, so it is reported without a fix.
		withImport('test("\u{1D400}bc", () => {});'),
		'import {test} from \'node:test\';\ntest(\'Uppercase\', \'str\', () => {});',
	],
});

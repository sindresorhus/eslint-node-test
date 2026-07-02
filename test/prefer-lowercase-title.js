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
	],
	invalid: [
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

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test("Foo", () => {});',

		// TypeScript
		{
			code: withImport('test("Foo" as string, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

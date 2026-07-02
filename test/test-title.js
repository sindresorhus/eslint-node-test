import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// Not a test file
		'test("my test", () => {});',
		'test(t => {});',
		// Valid test with string title
		'import test from "node:test";\ntest("my test", () => {});',
		'import test from "node:test";\ntest(\'my test\', () => {});',
		// Template literal title
		'import test from "node:test";\ntest(`my test`, () => {});',
		// Dynamic template literal — cannot validate statically
		// eslint-disable-next-line no-template-curly-in-string
		'import test from "node:test";\ntest(`test ${name}`, () => {});',
		// Named import `it`
		'import {it} from "node:test";\nit("my test", () => {});',
		// Named import `describe`
		'import {describe} from "node:test";\ndescribe("my suite", () => {});',
		// Renamed import
		'import {test as t} from "node:test";\nt("my test", () => {});',
		// Namespace import
		'import * as nodeTest from "node:test";\nnodeTest.test("my test", () => {});',
		// Hooks do not require a title
		'import {before, after, beforeEach, afterEach} from "node:test";\nbefore(() => {});\nafter(() => {});\nbeforeEach(() => {});\nafterEach(() => {});',
		// With options object (title still present)
		'import test from "node:test";\ntest("my test", {timeout: 1000}, () => {});',
		// Variable title — can't statically validate, skip
		'import test from "node:test";\nconst title = "foo";\ntest(title, () => {});',
	],
	invalid: [
		// Missing title — first arg is a function
		'import test from "node:test";\ntest(() => {});',
		// Missing title — first arg is an options object
		'import test from "node:test";\ntest({timeout: 1000}, () => {});',
		// Non-string literal title
		'import test from "node:test";\ntest(123, () => {});',
		'import test from "node:test";\ntest(true, () => {});',
		'import test from "node:test";\ntest(null, () => {});',
		// Empty title
		'import test from "node:test";\ntest("", () => {});',
		'import test from "node:test";\ntest(``, () => {});',
		'import test from "node:test";\ntest("   ", () => {});',
		// Leading/trailing whitespace (fixable)
		'import test from "node:test";\ntest(" foo ", () => {});',
		'import test from "node:test";\ntest("  foo", () => {});',
		'import test from "node:test";\ntest("foo  ", () => {});',
		// Single-quoted title keeps single quotes after fixing
		'import test from "node:test";\ntest(\' foo \', () => {});',
		// Template literal title becomes a single-quoted string after fixing
		'import test from "node:test";\ntest(`  foo  `, () => {});',
		// Named imports
		'import {it} from "node:test";\nit(() => {});',
		'import {describe} from "node:test";\ndescribe(() => {});',
		// Renamed import
		'import {test as myTest} from "node:test";\nmyTest(() => {});',
		// Namespace import
		'import * as nodeTest from "node:test";\nnodeTest.test(() => {});',
		// TypeScript
		{
			code: 'import test from "node:test";\ntest(() => {});',
			languageOptions: {parser: parsers.typescript},
		},
		// TypeScript — options object with no title, wrapped in `satisfies` / type assertion
		{
			code: 'import test from "node:test";\ntest({timeout: 1000} satisfies object, () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from "node:test";\ntest(<any>{timeout: 1000}, () => {});',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

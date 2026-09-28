import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// The object form's descriptor `name` is a real title
		'import test from \'node:test\';\ntest({name: \'a\', fn() {}});',
		'import test from \'node:test\';\ntest({name: \'a\', skip: true, fn() {}});',
		'import {it} from \'node:test\';\nit({name: \'a\', fn() {}});',

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
		// `node:test` names the test after `options.name`, so the untrimmed positional string is not the title
		'import test from "node:test";\ntest(" my test ", {name: "my test"}, () => {});',
		'import test from "node:test";\ntest(function body() {}, {name: "my test"});',
		// A spread after `name` could override it, so the title is not statically known
		'import test from "node:test";\ntest(" my test ", {name: "ok", ...rest}, () => {});',

		// A spread or computed key in the descriptor could supply the `name`, and `node:test`
		// spreads the descriptor, so the title is not statically known
		'import test from \'node:test\';\nconst rest = {name: \'z\'};\ntest({name: \'before\', ...rest});',
		'import test from \'node:test\';\ntest({...descriptor});',
		'import test from \'node:test\';\ntest({name: \'a\', [key]: 1});',

		// A first argument that holds an object is the descriptor, not a positional title
		'import test from \'node:test\';\nconst options = {name: \'x\'};\ntest(options, () => {});',
		'import test from \'node:test\';\nconst options = {name: \'x\', fn() {}};\ntest(options);',
	],
	invalid: [
		// The object form carries its title in the descriptor, so a `name` is not a missing title
		'import test from \'node:test\';\ntest({name: \' a \', fn() {}});',
		'import test from \'node:test\';\ntest({name: 1, fn() {}});',
		'import test from \'node:test\';\ntest({fn() {}});',

		// A function in the options slot is the implementation, so the positional title is the title
		'import test from \'node:test\';\nconst body = () => {};\ntest(\' a \', body);',

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
		// A statically resolved title is reported without a fix: rewriting it as a fresh string literal
		// would cut it off from the value it names, and drop a comment inside the expression it came from.
		'import test from "node:test";\ntest("foo" /* keep me */ + " ", () => {});',
		'import test from "node:test";\nconst titles = {a: " foo "};\ntest(titles /* keep me */.a, () => {});',
		'import test from "node:test";\ntest((0 /* keep me */, " foo "), () => {});',
		'import test from "node:test";\ntest("foo" + /* keep me */ " ", () => {});',
		'import test from "node:test";\nconst name = " foo ";\ntest(name, () => {});',
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
		// A leading descriptor names the test even when arguments follow, which `node:test` ignores
		'import test from \'node:test\';\ntest({name: \' a \'}, () => {});',
		// `options.name` is the title, so the fix rewrites it and leaves the positional string alone
		'import test from "node:test";\ntest("my test", {name: " a "}, () => {});',
		// A TypeScript wrapper around the name is kept, the same way the positional slot keeps it
		{
			code: 'import test from \'node:test\';\ntest(\'b\', {name: \' a \' as string}, () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from \'node:test\';\ntest(\'b\', {name: \' a \'!}, () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from \'node:test\';\ntest({name: \' a \' satisfies string, fn() {}});',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from \'node:test\';\ntest(\'c\', {name: <string>\' a \'}, () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		// A subtest is rendered in the output just like a test, so it needs a real title
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(() => {}); });',
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(123, () => {}); });',

		// A non-string title that is not a literal. `node:test` names every one of these `<anonymous>`,
		// and `getStaticValue` can resolve them, so they are as knowable as `test(123, …)`.
		'import test from "node:test";\ntest(undefined, () => {});',
		'import test from "node:test";\ntest(NaN, () => {});',
		// `options.name` wins over the positional title, so a non-string one leaves the test unnamed
		'import test from "node:test";\ntest(\'pos\', {name: 5}, () => {});',
		'import test from "node:test";\ntest(\'pos\', {name: undefined}, () => {});',
		'import test from "node:test";\ntest(() => {}, {name: 5});',
		// An options object with no `name` leaves the function-first form with no title either
		'import test from "node:test";\ntest(() => {}, {skip: true});',
		'import test from "node:test";\ntest(() => {}, {});',
		'import {describe} from "node:test";\ndescribe(() => {}, {skip: true});',
		'import {suite} from "node:test";\nsuite(() => {}, {skip: true});',
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(() => {}, {skip: true}); });',
		{
			code: 'import test from \'node:test\';\ntest((() => {}) as any, {skip: true});',
			languageOptions: {parser: parsers.typescript},
		},

		// A TypeScript wrapper around the implementation must not hide the missing title
		{
			code: 'import test from \'node:test\';\ntest((() => {}) as any);',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from \'node:test\';\ntest((() => {})!);',
			languageOptions: {parser: parsers.typescript},
		},
		// A template literal with an expression is a resolved title too, so it is reported without a fix
		// eslint-disable-next-line no-template-curly-in-string
		'import test from "node:test";\ntest(`${"foo"} `, () => {});',
	],
});

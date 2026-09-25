import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// An options key beside `name`/`fn` is real intent
		'import test from \'node:test\';\ntest({name: \'t\', skip: true, fn() {}});',
		'import test from \'node:test\';\ntest(\'t\', {skip: true}, () => {});',
		'import test from \'node:test\';\ntest({name: \'t\', timeout: 1, fn() {}});',
		'import test from \'node:test\';\ntest(\'t\', {fn: other});',
		'import test from \'node:test\';\ntest(\'t\', {});',

		// Not a test file
		'test("x");',

		// Test with a real body
		withImport('test("x", () => { assert.ok(a); });'),

		// Expression-body arrow is not an empty block
		withImport('test("x", () => doSomething());'),

		// Already a `.todo`
		'import {test} from \'node:test\';\ntest.todo("x");',

		// Expected failures are intentional placeholders, not todos.
		'import {expectFailure} from \'node:test\';\nexpectFailure("x", () => {});',

		// Intentional stub via options object
		withImport('test("x", {skip: true});'),

		// Options object alongside an empty body is still intentional
		withImport('test("x", {skip: true}, () => {});'),
		withImport('test("x", {todo: true}, () => {});'),

		// No title — cannot make a meaningful `.todo`
		withImport('test(myTitle, () => {});'),

		// Suites and hooks are out of scope
		'import {describe} from \'node:test\';\ndescribe("s", () => {});',

		// A call with no arguments has no callback to read, and must not crash the rule
		'import {test} from \'node:test\';\ntest();',
		'import {test} from \'node:test\';\ntest(\'p\', t => { t.test(); });',
		'import {test, getTestContext} from \'node:test\';\ntest(\'p\', () => { getTestContext().test(); });',
	],
	invalid: [
		// The object form is an empty placeholder too, and `name`/`fn` carry no intent
		'import test from \'node:test\';\ntest({name: \'t\', fn() {}});',
		'import test from \'node:test\';\ntest(\'t\', {fn() {}});',
		'import test from \'node:test\';\ntest({name: \'t\'});',
		'import {it} from \'node:test\';\nit({name: \'t\', fn() {}});',

		// A TypeScript wrapper around the callback must not crash the fixer
		{
			code: 'import test from "node:test";\ntest("t", (() => {}) satisfies unknown);',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from "node:test";\ntest("t", (() => {})!);',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from "node:test";\ntest("t", (() => {}) as unknown);',
			languageOptions: {parser: parsers.typescript},
		},
		// A comment in the argument gap or the body would be removed with the callback,
		// so the test is reported but no fix is offered
		'import test from \'node:test\';\ntest(\'placeholder\', /* keep me */ () => {});',
		'import test from \'node:test\';\ntest(\'placeholder\', () => { /* keep me */ });',
		'import test from \'node:test\';\ntest(\'placeholder\', () => {\n  // keep me\n});',

		// Title only
		withImport('test("x");'),

		// Empty body
		withImport('test("x", () => {});'),

		// Empty function-expression body
		withImport('test("x", function () {});'),

		// Empty async body
		withImport('test("x", async () => {});'),

		// `it` alias
		'import {it} from \'node:test\';\nit("x", () => {});',

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test("x", () => {});',

		// Empty body with a comment — reported but not fixed (would drop the comment)
		withImport('test("x", () => {\n\t// TODO: write this\n});'),

		// TypeScript
		{
			code: withImport('test("x", (): void => {});'),
			languageOptions: {parser: parsers.typescript},
		},

		// A comment in the gap after the callback would be left behind describing the title
		'import test from \'node:test\';\ntest(\'placeholder\', () => {} /* keep me */);',
		'import test from \'node:test\';\ntest(\'placeholder\', () => {\n} /* keep me */);',
		// A subtest is a test too, but has no `.todo` method, so it is reported without a suggestion
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'a\', () => {}); });',

		// A hook callback is handed the context of the test it runs for, so an empty subtest created
		// there is the same placeholder
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.test(\'c\', () => {}); });',
		'import {getTestContext, beforeEach} from \'node:test\';\nbeforeEach(t => { getTestContext().test(\'c\', () => {}); });',
	],
});

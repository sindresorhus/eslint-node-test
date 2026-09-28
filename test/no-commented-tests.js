import {getTester} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// Regular comment with no test call
		'// Just a regular comment',
		// Comment mentioning "test" but not a call
		'// Run the tests',
		'// This test documents behavior',
		// Comment with test not at start
		'// See test() for details',
		// Comment with similar but not matching word
		'// testing("foo", () => {})',
		'// contest("foo", () => {})',
		// "test" at start but no parenthesis
		'// test without parentheses',
		// Real code never writes `test (`, but prose routinely does
		'// test (the runner entry point)',
		'// it (as shown above) is used for subtests',
		'// test (see docs) runs only in CI',
		// JSDoc block comment — should be ignored
		'/**\n * test("example", () => {});\n */',
		'/**\n * before(() => {});\n */',
		// Just hooks without test calls - but hooks ARE test-related; let's make them invalid later
		// Below: valid because it's not a test-like structure
		'// Some before() information',
		// Dotted call that is not a real node:test modifier — not a commented-out test
		'// it.each([1, 2])("foo", () => {})',
		'// test.config({ timeout: 1 })',
		'// describe.configure()',
		// `name` is not a `node:test` export, so a chain through it is prose
		'// test.name(x)',
		'// test.it.name(x)',
		// `Function.prototype` has no node:test export names, so a `describe.name(…)` call is prose
		'// describe.name(x)',
		'// test.await("foo", () => {})',
		// A non-test `node:test` export is documentation of that API, not dead test code
		'// test.snapshot({invalid: []});',
		'// test.mock.method(object, \'value\', () => 1);',
		'// getTestContext().test("foo", () => {});',
		// A comment that is not a test call, next to a live one
		'import {test} from \'node:test\';\n// TODO: split this up\ntest(\'a\', () => {});',
	],
	invalid: [
		// `test.test(…)` and `test.it(…)` register a test exactly as `test(…)` does
		'// test.test(\'a\', () => {});',
		'// test.it(\'a\', () => {});',
		'// it.it(\'a\', () => {});',
		'import * as nodeTest from \'node:test\';\n// nodeTest.test(\'a\', () => {});',
		// Line comment with test(
		'// test("foo", () => {',
		// Line comment with it(
		'// it("foo", () => {',
		// Line comment with describe(
		'// describe("group", () => {',
		// Line comment with suite(
		'// suite("group", () => {',
		// Line comment with before(
		'// before(() => {',
		// Line comment with after(
		'// after(() => {',
		// Line comment with beforeEach(
		'// beforeEach(() => {',
		// Line comment with afterEach(
		'// afterEach(() => {',
		// No space after //
		'//test("foo", () => {})',
		// Test.only(
		'// test.only("foo", () => {})',
		// Test.skip(
		'// test.skip("foo", () => {})',
		// It.only(
		'// it.only("foo", () => {})',
		// Block comment
		'/* test("foo", () => {}) */',
		// Multi-line block comment
		'/*\n * test("foo", () => {\n */',
		// Describe with modifier
		'// describe.only("group", () => {})',
		// Chained todo modifier
		'// it.todo("foo", () => {})',
		// Chained todo modifier on `test`
		'// test.todo("foo", () => {})',
		// The static `node:test` exports on the test function
		'// test.describe("group", () => {})',
		'// test.suite("group", () => {})',
		'// test.beforeEach(() => {})',
		'// it.after(() => {})',
		// A top-level test awaited from module scope
		'// await test("foo", async () => {})',

		// A commented-out call names the local binding, so an aliased import has to match too
		'import {test as t} from \'node:test\';\n// t(\'a\', () => {});',
		'import {it as check} from \'node:test\';\n// check(\'a\', () => {});',
		'import {test as t} from \'node:test\';\n// t.skip(\'a\', () => {});',
		'import {test as testCase} from \'node:test\';\n// testCase(\'a\', () => {});',
		// A `$` in an alias is part of the name, not a regular expression anchor
		'import {test as $t} from \'node:test\';\n// $t(\'x\', () => {});',
		'import * as $nodeTest from \'node:test\';\n// $nodeTest.test(\'x\', () => {});',
		'import {test} from \'node:test\';\n// test(\'a\', () => {});\ntest(\'b\', () => {});',
	],
});

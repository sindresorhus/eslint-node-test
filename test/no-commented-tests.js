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
	],
	invalid: [
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
	],
});

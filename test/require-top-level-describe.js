import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const head = 'import {describe, test, it, before, beforeEach} from \'node:test\';\n';

test.snapshot({
	valid: [
		// Not a test file
		'test("a", () => {});',

		// Everything inside a top-level describe
		head + 'describe("s", () => { it("a", () => {}); });',
		head + 'describe("s", () => { beforeEach(() => {}); it("a", () => {}); });',

		// Nested describes are fine
		head + 'describe("s", () => { describe("inner", () => { it("a", () => {}); }); });',

		// Multiple top-level describes allowed by default
		head + 'describe("a", () => { it("x", () => {}); });\ndescribe("b", () => { it("y", () => {}); });',

		// Within the configured cap
		{code: head + 'describe("a", () => {});\ndescribe("b", () => {});', options: [{maxTopLevelDescribes: 2}]},
	],
	invalid: [
		// Top-level test
		head + 'test("a", () => {});',

		// Top-level it
		head + 'it("a", () => {});',

		// Top-level hook
		head + 'beforeEach(() => {});\ndescribe("s", () => { it("a", () => {}); });',

		// Mixed top-level test alongside a describe
		head + 'test("a", () => {});\ndescribe("s", () => { it("b", () => {}); });',

		// Too many top-level describes
		{code: head + 'describe("a", () => {});\ndescribe("b", () => {});\ndescribe("c", () => {});', options: [{maxTopLevelDescribes: 2}]},

		// TypeScript
		{
			code: head + 'test("a", () => {});',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

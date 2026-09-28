import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const head = 'import {describe, test, it, before, beforeEach} from \'node:test\';\n';

test.snapshot({
	valid: [
		// The cap is opt-in: with no options, any number of top-level describes is fine
		{code: 'import {describe} from \'node:test\';\ndescribe("a", () => {});\ndescribe("b", () => {});\ndescribe("c", () => {});'},

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

		// A `describe` inside a helper function or a hook body is not top-level, even though
		// neither is nested in another suite
		{
			code: head + 'function register() { describe("a", () => {}); describe("b", () => {}); }\ndescribe("outer", () => { register(); });',
			options: [{maxTopLevelDescribes: 1}],
		},
		{
			code: head + 'describe("outer", () => { before(() => { describe("a", () => {}); describe("b", () => {}); }); });',
			options: [{maxTopLevelDescribes: 1}],
		},

		// A test declared inside a helper function may well run inside a suite
		head + 'function register() { it("x", () => {}); }\ndescribe("outer", () => { register(); });',
		head + 'const helpers = {register() { it("x", () => {}); }};\ndescribe("outer", () => { helpers.register(); });',
		// A class method is a function too, so a `describe` in one is not top-level
		{
			code: head + 'class C { register() { describe("a", () => {}); describe("b", () => {}); } }',
			options: [{maxTopLevelDescribes: 1}],
		},
		// A callback that is only passed on, not run by an array method, is a real scope boundary
		head + 'register(() => { test("a", () => {}); });',
		head + '[1, 2].forEach(() => { describe("s", () => { test("n", () => {}); }); });',
		// The cap counts call sites, so a `describe` in a loop counts once, as in a `for…of` body
		{code: head + '[1, 2].forEach(() => { describe("s", () => {}); });', options: [{maxTopLevelDescribes: 1}]},
		// Exactly at the cap
		{code: head + 'describe("a", () => {});', options: [{maxTopLevelDescribes: 1}]},
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

		// The `suite` alias counts toward the cap
		{code: 'import {suite} from \'node:test\';\nsuite("a", () => {});\nsuite("b", () => {});', options: [{maxTopLevelDescribes: 1}]},

		// A subtest is not a separate registration, so only the top-level test is reported
		head + 'test("a", async t => { await t.test("b", () => {}); });',

		// An array-iteration callback at module scope runs while the file loads, like a `for…of` body
		head + '[1, 2].forEach(() => { test("n", () => {}); });',
		head + 'for (const _ of [1, 2]) { test("n", () => {}); }',
		head + '[1, 2].map(() => it("n", () => {}));',

		// TypeScript
		{
			code: head + 'test("a", () => {});',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

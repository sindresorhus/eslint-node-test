import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const head = 'import {test, it, describe, suite} from \'node:test\';\n';

test.snapshot({
	valid: [
		// Not a test file
		'it("a", () => {});',

		// Defaults: `test` at top level, `it` within describe
		head + 'test("a", () => {});',
		head + 'describe("s", () => { it("a", () => {}); });',
		head + 'test("a", () => {});\ndescribe("s", () => { it("b", () => {}); });',

		// Custom option: `it` everywhere
		{code: head + 'it("a", () => {});', options: [{fn: 'it', withinDescribe: 'it'}]},

		// Custom option: `test` within describe
		{code: head + 'describe("s", () => { test("a", () => {}); });', options: [{withinDescribe: 'test'}]},

		// Nested describe still uses withinDescribe
		head + 'describe("s", () => { describe("inner", () => { it("a", () => {}); }); });',

		// `suite` is an alias for `describe` and counts as a containing suite
		head + 'suite("s", () => { it("a", () => {}); });',

		// Namespace import — `test` at top level is already correct
		'import * as nodeTest from \'node:test\';\nnodeTest.test("a", () => {});',

		// The standalone expected-failure export is still a `test`.
		'import {expectFailure} from \'node:test\';\nexpectFailure("a", () => {});',

		// A suite declared inside a test body does not put that test inside a `describe`
		head + 'test("a", () => { describe("s", () => {}); });',

		// A `node:test` export that is not a test call
		'import {mock} from \'node:test\';\nmock.module(\'module.js\');',
	],
	invalid: [
		// `it` at the top level (default wants `test`)
		head + 'it("a", () => {});',

		// `test` within describe (default wants `it`)
		head + 'describe("s", () => { test("a", () => {}); });',

		// Mixed
		head + 'test("a", () => {});\ndescribe("s", () => { test("b", () => {}); });',

		// Custom option: enforce `test` everywhere
		{code: head + 'describe("s", () => { it("a", () => {}); });', options: [{fn: 'test', withinDescribe: 'test'}]},

		// Custom option: enforce `it` at the top level (so top-level `test` is wrong)
		{code: head + 'test("a", () => {});', options: [{fn: 'it'}]},

		// Modifier form
		head + 'it.only("a", () => {});',

		// Namespace import — `it` at top level (default wants `test`)
		'import * as nodeTest from \'node:test\';\nnodeTest.it("a", () => {});',
		'import {it} from \'node:test\';\nit.expectFailure("a", () => {});',

		// A namespace `describe` still opens a suite
		'import * as nodeTest from \'node:test\';\nnodeTest.describe("s", () => { nodeTest.test("a", () => {}); });',

		// `suite` is an alias for `describe` on the reporting side too
		head + 'suite("s", () => { test("a", () => {}); });',

		// TypeScript
		{
			code: head + 'it("a", () => {});',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

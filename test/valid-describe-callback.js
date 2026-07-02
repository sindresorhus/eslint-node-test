import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {describe, suite} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'describe("s", t => {});',

		// No parameter, block body — the correct form
		withImport('describe("s", () => { test("x", () => {}); });'),

		// Explicit `return` in a block body is not reported (only implicit expression-body returns are)
		withImport('describe("s", () => { return test("x", () => {}); });'),

		// Function expression with no parameter
		withImport('describe("s", function () {});'),

		// No callback (options only)
		withImport('describe("s", {skip: true});'),

		// `test`/`it` callbacks may take the context parameter
		'import test from \'node:test\';\ntest("x", t => {});',
	],
	invalid: [
		// Arrow callback with a parameter
		withImport('describe("s", t => {});'),

		// Function expression with a parameter
		withImport('describe("s", function (t) {});'),

		// `suite` alias with a parameter
		withImport('suite("s", t => {});'),

		// Destructured first parameter
		withImport('describe("s", ({name}) => {});'),

		// Arrow with an expression body (implicit return)
		withImport('describe("s", () => test("x", () => {}));'),

		// Both problems at once: a parameter and an implicit return
		withImport('describe("s", t => test("x", () => {}));'),

		// `describe.only`
		withImport('describe.only("s", t => {});'),

		// `describe.skip` — modifiers do not exempt the callback from the check
		withImport('describe.skip("s", t => {});'),

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.describe("s", t => {});',

		// ESM default import used as a namespace — `test.describe(…)`
		'import test from \'node:test\';\ntest.describe("s", t => {});',

		// TypeScript
		{
			code: withImport('describe("s", (t: SuiteContext) => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

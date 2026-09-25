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

		// `node:test` calls a suite callback with a `SuiteContext`, so a parameter is a real use
		withImport('describe("s", t => { t.diagnostic("x"); test("x", () => {}); });'),
		withImport('describe("s", t => { t.signal.addEventListener("abort", () => {}); test("x", () => {}); });'),
		withImport('describe("s", ({name, diagnostic}) => { diagnostic(name); test("x", () => {}); });'),
		withImport('suite("s", function (t) { t.diagnostic("x"); test("x", () => {}); });'),
		withImport('describe.only("s", t => { t.diagnostic("x"); test("x", () => {}); });'),
		withImport('describe.skip("s", t => { t.diagnostic("x"); test("x", () => {}); });'),
		'import * as nodeTest from \'node:test\';\nnodeTest.describe("s", t => { t.diagnostic("x"); test("x", () => {}); });',
		'import test from \'node:test\';\ntest.describe("s", t => { t.diagnostic("x"); test("x", () => {}); });',
		{
			code: withImport('describe("s", (t: SuiteContext) => { t.diagnostic("x"); test("x", () => {}); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Arrow callback with an expression body (implicit return)
		withImport('describe("s", () => test("x", () => {}));'),

		// A context parameter does not excuse an implicit return
		withImport('describe("s", t => test("x", () => {}));'),

		// Function expression with an expression body is not a thing, so the arrow covers both
		withImport('describe("s", () => ({name: "s"}));'),

		// `suite` alias
		withImport('suite("s", () => test("x", () => {}));'),

		// `describe.only`
		withImport('describe.only("s", () => test("x", () => {}));'),

		// `describe.skip` — modifiers do not exempt the callback from the check
		withImport('describe.skip("s", () => test("x", () => {}));'),

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.describe("s", () => test("x", () => {}));',

		// ESM default import used as a namespace — `test.describe(…)`
		'import test from \'node:test\';\ntest.describe("s", () => test("x", () => {}));',

		// TypeScript
		{
			code: withImport('describe("s", () => test("x", () => {}) as unknown);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

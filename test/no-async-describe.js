import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, describe, suite, beforeEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'describe("s", async () => {});',

		// Synchronous describe with async tests inside — the correct pattern
		withImport('describe("s", () => { test("x", async () => { await f(); }); });'),

		// Async test/hook callbacks are fine (awaited by node:test)
		withImport('test("x", async () => { await f(); });'),
		withImport('beforeEach(async () => { await f(); });'),

		// Describe with no callback (e.g. options only)
		withImport('describe("s", {skip: true});'),

		// A callback the call names out of line is still the callback the runner awaits
		withImport('const body = () => {};\ndescribe("s", body);'),
		withImport('function body() {}\ndescribe("s", body);'),
		withImport('const body = async () => {};\ntest("x", body);'),
		// An options object is not a callback
		withImport('const options = {skip: true};\ndescribe("s", options);'),

		// `t.test` is a subtest, not a suite, so an async subtest callback is awaited like a test's
		withImport('test("t", t => { t.test("s", async () => { await f(); }); });'),
	],
	invalid: [
		// A named callback is knowable without type information: its binding is in the same file
		withImport('const callback = async () => {};\ndescribe("s", callback);'),

		// A suite callback named out of line is awaited just the same
		withImport('const body = async () => {};\ndescribe("s", body);'),
		withImport('async function body() {}\ndescribe("s", body);'),
		withImport('const body = async () => {};\nsuite("s", body);'),
		withImport('const name = "s";\nconst body = async () => {};\ndescribe(name, body);'),
		withImport('const body = async () => {};\ndescribe("s", {fn: body});'),

		// Async describe
		withImport('describe("s", async () => { test("x", () => {}); });'),

		// Async suite alias
		withImport('suite("s", async () => { test("x", () => {}); });'),

		// Async function expression
		withImport('describe("s", async function () { test("x", () => {}); });'),

		// Async describe even when registration precedes the await — still fragile
		withImport('describe("s", async () => { test("a", () => {}); await f(); test("b", () => {}); });'),

		// `describe.only`
		withImport('describe.only("s", async () => {});'),

		// `describe.skip`
		withImport('describe.skip("s", async () => {}, {skip: true});'),

		// Renamed import
		'import {describe as group} from \'node:test\';\ngroup("s", async () => {});',

		// The suite callback in the object descriptor form is async too
		withImport('describe({name: "s", fn: async () => {}});'),
		withImport('describe("s", {fn: async () => {}});'),

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.describe("s", async () => {});',

		// TypeScript
		{
			code: withImport('describe("s", async (): Promise<void> => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			// A TypeScript assertion wrapping the callback does not hide it
			code: withImport('describe("s", (async () => {}) as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},

		// A body shared by two suites is one function, so it is reported once
		withImport('async function body() {}\ndescribe("a", body);\ndescribe("b", body);'),
	],
});

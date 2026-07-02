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
	],
	invalid: [
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

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.describe("s", async () => {});',

		// TypeScript
		{
			code: withImport('describe("s", async (): Promise<void> => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

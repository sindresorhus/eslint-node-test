import {fileURLToPath} from 'node:url';
import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test, {it, before, after, beforeEach, afterEach} from 'node:test';\n${code}`;

// Type-aware cases need a `.ts` filename inside `test/fixtures/` (see `parsers.typescriptWithTypes`).
const filename = fileURLToPath(new URL('fixtures/inline.ts', import.meta.url));
const typedCode = code => ({
	code,
	filename,
	languageOptions: {parser: parsers.typescriptWithTypes},
});
const typed = code => typedCode(withImport(code));

test.snapshot({
	valid: [
		// No type information available — the rule does nothing.
		withImport('test("x", () => { return 42; });'),
		withImport('beforeEach(() => { return 42; });'),

		// Returning a Promise
		typed('test("x", () => { return Promise.resolve(); });'),
		typed('test("x", async () => { return Promise.resolve(1); });'),
		typed('test("x", () => { const p: Promise<void> = Promise.resolve(); return p; });'),
		typed('beforeEach(() => { return Promise.resolve(); });'),
		typed('beforeEach(() => { return Promise.resolve(); }, {timeout: 1000});'),

		// An `async` function wraps its return in a Promise, so a plain value is fine
		typed('test("x", async () => { return 1; });'),
		typed('test("x", async () => { return computeValue(); });'),
		typed('afterEach(async () => { return 1; });'),

		// Returning nothing
		typed('test("x", () => { return; });'),
		typed('test("x", () => {});'),
		typed('before(() => { return; });'),

		// Return inside a nested helper, not the test callback
		typed('test("x", () => { const helper = () => { return 1; }; helper(); });'),
		typed('after(() => { const helper = () => { return 1; }; helper(); });'),
	],
	invalid: [
		// Returning a number
		typed('test("x", () => { return 42; });'),

		// Returning an object
		typed('test("x", () => { return {a: 1}; });'),

		// Returning an array
		typed('test("x", () => { return [1, 2]; });'),

		// Returning a string
		typed('test("x", () => { return "done"; });'),

		// Returning a boolean expression
		typed('test("x", () => { const a = 1, b = 2; return a === b; });'),

		// `it` alias
		typed('it("x", () => { return 1; });'),

		// Hooks
		typed('before(() => { return 1; });'),
		typed('after(() => { return "done"; });'),
		typed('beforeEach(() => { return {a: 1}; });'),
		typed('afterEach(() => { return [1, 2]; });'),
		typed('beforeEach(() => { return 1; }, {timeout: 1000});'),
		typed('beforeEach((() => { return 1; }) as () => number);'),

		// Default import member hook
		typed('test.beforeEach(() => { return 1; });'),

		// Namespace import hook
		typedCode('import * as nodeTest from \'node:test\';\nnodeTest.beforeEach(() => { return 1; });'),

		// Renamed hook import
		typedCode('import {beforeEach as setup} from \'node:test\';\nsetup(() => { return 1; });'),
	],
});

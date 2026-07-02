import {fileURLToPath} from 'node:url';
import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, it} from 'node:test';\n${code}`;

// Type-aware cases need a `.ts` filename inside `test/fixtures/` (see `parsers.typescriptWithTypes`).
const filename = fileURLToPath(new URL('fixtures/inline.ts', import.meta.url));
const typed = code => ({
	code: withImport(code),
	filename,
	languageOptions: {parser: parsers.typescriptWithTypes},
});

test.snapshot({
	valid: [
		// No type information available — the rule does nothing.
		withImport('test("x", () => { return 42; });'),

		// Returning a Promise
		typed('test("x", () => { return Promise.resolve(); });'),
		typed('test("x", async () => { return Promise.resolve(1); });'),
		typed('test("x", () => { const p: Promise<void> = Promise.resolve(); return p; });'),

		// An `async` function wraps its return in a Promise, so a plain value is fine
		typed('test("x", async () => { return 1; });'),
		typed('test("x", async () => { return computeValue(); });'),

		// Returning nothing
		typed('test("x", () => { return; });'),
		typed('test("x", () => {});'),

		// Return inside a nested helper, not the test callback
		typed('test("x", () => { const helper = () => { return 1; }; helper(); });'),
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
	],
});

import {getTester} from './utils/test.js';

const {test} = getTester(import.meta);

// Helpers for building test code with the import header.
const withImport = (hookImports, code) => `import test, {${hookImports}} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// No hooks at all
		'import test from "node:test";\ntest("a", () => {});',
		// Correct order: before, beforeEach, afterEach, after
		withImport('before, beforeEach, afterEach, after', 'before(() => {});\nbeforeEach(() => {});\nafterEach(() => {});\nafter(() => {});'),
		// Only before and after (correct)
		withImport('before, after', 'before(() => {});\nafter(() => {});'),
		// Only before and afterEach (correct)
		withImport('before, afterEach', 'before(() => {});\nafterEach(() => {});'),
		// Only beforeEach and afterEach (correct)
		withImport('beforeEach, afterEach', 'beforeEach(() => {});\nafterEach(() => {});'),
		// Only beforeEach and after (correct)
		withImport('beforeEach, after', 'beforeEach(() => {});\nafter(() => {});'),
		// Only before (single hook, no ordering needed)
		withImport('before', 'before(() => {});'),
		// Only after (single hook, no ordering needed)
		withImport('after', 'after(() => {});'),
		// Hooks with tests (tests can be in any position relative to hooks)
		withImport('before, after', 'before(() => {});\nafter(() => {});\ntest("a", () => {});'),
		// Non-test code between hooks (no fix applied when code between)
		withImport('before, after', 'before(() => {});\nconsole.log("setup");\nafter(() => {});'),
		// Not a test file (no import)
		'before(() => {});\nafterEach(() => {});\nbeforeEach(() => {});',
		// Namespace import, correct order
		'import * as nodeTest from "node:test";\nnodeTest.before(() => {});\nnodeTest.beforeEach(() => {});',
		// Hooks used as a sub-expression (not bare statements) are unsupported, so not ordered
		withImport('before, after', 'const a = after(() => {});\nconst b = before(() => {});'),
	],
	invalid: [
		// After before before
		withImport('before, after', 'after(() => {});\nbefore(() => {});'),
		// AfterEach before before
		withImport('before, afterEach', 'afterEach(() => {});\nbefore(() => {});'),
		// AfterEach before beforeEach
		withImport('beforeEach, afterEach', 'afterEach(() => {});\nbeforeEach(() => {});'),
		// After before beforeEach
		withImport('beforeEach, after', 'after(() => {});\nbeforeEach(() => {});'),
		// After before beforeEach with extra test
		withImport('before, beforeEach, after', 'before(() => {});\nafter(() => {});\nbeforeEach(() => {});\ntest("a", () => {});'),
		// Renamed import
		'import {before as b, after as a} from "node:test";\na(() => {});\nb(() => {});',
		// Out-of-order hooks with intervening non-hook code — reported but no fix applied
		withImport('before, after', 'after(() => {});\nconsole.log("side effect");\nbefore(() => {});'),
		// Out-of-order hooks with a comment between them — reported but no fix (comment must not move)
		withImport('before, after', 'after(() => {});\n// setup\nbefore(() => {});'),
		// Out-of-order hooks indented inside a `describe` (fix must preserve indentation)
		withImport('describe, before, after', 'describe("s", () => {\n\tafter(() => {});\n\tbefore(() => {});\n});'),
		// Fully reversed four hooks — the fix sorts the whole block in one pass
		withImport('before, beforeEach, afterEach, after', 'after(() => {});\nafterEach(() => {});\nbeforeEach(() => {});\nbefore(() => {});'),
		// Out-of-order hooks in two separate describe blocks — each block is ordered independently
		withImport('describe, before, after', 'describe("a", () => {\n\tafter(() => {});\n\tbefore(() => {});\n});\ndescribe("b", () => {\n\tafter(() => {});\n\tbefore(() => {});\n});'),
	],
});

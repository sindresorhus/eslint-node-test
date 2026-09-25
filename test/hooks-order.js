import {getTester, parsers} from './utils/test.js';

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
		// Every statement list a hook can be declared in: a class static block, a bare `switch` case,
		// and a case with its own block
		'import {after, before} from \'node:test\';\nclass A {\n\tstatic {\n\t\tafter(() => {});\n\t\tbefore(() => {});\n\t}\n}',
		'import {afterEach, before} from \'node:test\';\nswitch (value) {\n\tcase 1:\n\t\tafterEach(() => {});\n\t\tbefore(() => {});\n\t\tbreak;\n}',
		'import {after, before} from \'node:test\';\nswitch (value) {\n\tcase 1: {\n\t\tafter(() => {});\n\t\tbefore(() => {});\n\t}\n}',
		'import {after, before} from \'node:test\';\nclass A {\n\tstatic {\n\t\tafter(() => {});\n\t\twork();\n\t\tbefore(() => {});\n\t}\n}',

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
		// Namespace import out of order — reordered by rewriting each member call
		'import * as nodeTest from "node:test";\nnodeTest.after(() => {});\nnodeTest.before(() => {});',
		// Out-of-order hooks with intervening non-hook code — reported but no fix applied
		withImport('before, after', 'after(() => {});\nconsole.log("side effect");\nbefore(() => {});'),
		// Out-of-order hooks with a comment between them — reported but no fix (comment must not move)
		withImport('before, after', 'after(() => {});\n// setup\nbefore(() => {});'),
		// Trailing comment on the last hook — reported but no fix (comment would be misattributed)
		withImport('before, after', 'after(() => {});\nbefore(() => {}); // comment'),
		// Leading comment on the first hook — reported but no fix, same reason as the trailing one
		withImport('before, after', '// teardown\nafter(() => {});\nbefore(() => {});'),
		// Same, with a block comment on the preceding line
		withImport('before, after', '/* teardown */\nafter(() => {});\nbefore(() => {});'),
		// Same, with a block comment on the hook's own line (outside the statement range)
		withImport('before, after', '/* teardown */ after(() => {});\nbefore(() => {});'),
		// A block comment separated by a blank line belongs to the block, not the hook, so it is still fixable
		withImport('before, after', '// file header\n\nafter(() => {});\nbefore(() => {});'),
		// Out-of-order hooks indented inside a `describe` (fix must preserve indentation)
		withImport('describe, before, after', 'describe("s", () => {\n\tafter(() => {});\n\tbefore(() => {});\n});'),
		// Fully reversed four hooks — the fix sorts the whole block in one pass
		withImport('before, beforeEach, afterEach, after', 'after(() => {});\nafterEach(() => {});\nbeforeEach(() => {});\nbefore(() => {});'),
		// Out-of-order hooks in two separate describe blocks — each block is ordered independently
		withImport('describe, before, after', 'describe("a", () => {\n\tafter(() => {});\n\tbefore(() => {});\n});\ndescribe("b", () => {\n\tafter(() => {});\n\tbefore(() => {});\n});'),

		// TypeScript wrapper on a hook call must not prevent detection
		{
			code: withImport('before, after', 'after(() => {}) as void;\nbefore(() => {}) as void;'),
			languageOptions: {parser: parsers.typescript},
		},
		// A hook declared on a test context has the same canonical order
		'import {test} from \'node:test\';\ntest(\'p\', t => { t.afterEach(() => {}); t.beforeEach(() => {}); });',

		// A hook declared through `getTestContext()` is the same hook
		'import {test, getTestContext} from \'node:test\';\ntest(\'p\', t => { getTestContext().afterEach(() => {}); getTestContext().beforeEach(() => {}); });',

		// A statement written as `(hook(…))` continues the expression above it once the two are
		// adjacent, so the reorder gives it a leading semicolon
		'import {before, afterEach, test} from \'node:test\';\n\n(afterEach(() => {}))\nbefore(() => {})\n\ntest(\'a\', () => {});',

		// A statement above the run also continues into the moved one when that one starts with a
		// bracket, even when nothing is between them
		'import {before, after} from \'node:test\';\nconst value = []\nafter(() => {});\n(before(() => {}));',

		// A statement below the block that starts with a bracket continues the moved statement unless
		// the moved statement keeps its own semicolon
		'import {after, before, beforeEach} from \'node:test\';\n\nafter(() => {})\nbefore(() => {});\nbeforeEach(() => {});\n(async () => {\n\tawait Promise.resolve();\n})();',
		'import {after, before} from \'node:test\';\n\nafter(() => {})\nbefore(() => {});\n[1].forEach(f);',
	],
});

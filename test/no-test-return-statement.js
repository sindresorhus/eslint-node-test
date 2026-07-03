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
		// No type information available, the rule does nothing.
		withImport('test("x", () => { return 42; });'),
		withImport('beforeEach(() => { return 42; });'),

		// Returning a Promise
		typed('test("x", () => { return Promise.resolve(); });'),
		typed('test("x", async () => { return Promise.resolve(1); });'),
		typed('test("x", () => { const p: Promise<void> = Promise.resolve(); return p; });'),
		typed('beforeEach(() => { return Promise.resolve(); });'),
		typed('beforeEach(() => { return Promise.resolve(); }, {timeout: 1000});'),
		typed('beforeEach(() => { const value: Promise<void> | undefined = Math.random() > 0.5 ? Promise.resolve() : undefined; return value; });'),
		typed('beforeEach(() => Promise.resolve());'),
		typed('test("x", t => { t.test("y", () => Promise.resolve()); });'),
		typed('test("x", t => { t.beforeEach(() => Promise.resolve()); });'),
		typed('test("x", t => { const helper = (t: {beforeEach: (callback: () => {a: number}) => void}) => { t.beforeEach(() => ({a: 1})); }; });'),
		typed('test("x", t => { const helper = (t: {test: (title: string, callback: () => number) => void}) => { t.test("y", () => 1); }; });'),
		typed('test("x", t => { t.test("y", async () => 1); });'),
		typed('test("x", t => { t.beforeEach(async () => 1); });'),
		typed('beforeEach(t => { t.beforeEach(() => Promise.resolve()); });'),
		typed('beforeEach(t => { const helper = (t: {beforeEach: (callback: () => {a: number}) => void}) => { t.beforeEach(() => ({a: 1})); }; });'),
		typedCode('import test from \'node:test\';\ntest.each("x", () => 1);'),
		typedCode('import {test} from \'node:test\';\ntest.each("x", () => 1);'),
		typedCode('import * as nodeTest from \'node:test\';\nnodeTest.test.each("x", () => 1);'),

		// An `async` function wraps its return in a Promise, so a plain value is fine
		typed('test("x", async () => { return 1; });'),
		typed('afterEach(async () => { return 1; });'),
		typed('beforeEach(async () => 1);'),

		// Returning nothing
		typed('test("x", () => { return; });'),
		typed('test("x", () => {});'),
		typed('before(() => { return; });'),
		typed('test("x", () => null);'),

		// Return inside a nested helper, not the test callback
		typed('test("x", () => { const helper = () => { return 1; }; helper(); });'),
		typed('after(() => { const helper = () => { return 1; }; helper(); });'),
	],
	invalid: [
		// Returning a number
		typed('test("x", () => { return 42; });'),
		typed('test("x", () => 42);'),

		// Returning an object
		typed('test("x", () => { return {a: 1}; });'),

		// Returning an array
		typed('test("x", () => { return [1, 2]; });'),

		// Returning a string
		typed('test("x", () => { return "done"; });'),

		// Returning a boolean expression
		typed('test("x", () => { const a = 1, b = 2; return a === b; });'),

		// Returning a mixed Promise/non-Promise union
		typed('test("x", () => { const value: Promise<void> | number = Math.random() > 0.5 ? Promise.resolve() : 1; return value; });'),

		// `it` alias
		typed('it("x", () => { return 1; });'),

		// Test context methods
		typed('test("x", t => { t.test("y", () => 1); });'),
		typed('test("x", t => { t.test.only("y", () => 1); });'),
		typed('test("x", t => { t.before(() => 1); });'),
		typed('test("x", t => { t.beforeEach(() => ({a: 1})); });'),
		typed('test("x", t => { t.after(() => "done"); });'),
		typed('test("x", t => { t.afterEach(() => [1, 2]); });'),
		typed('beforeEach(t => { t.beforeEach(() => ({a: 1})); });'),
		typed('beforeEach(t => { t.test("y", () => 1); });'),
		typed('beforeEach(t => { t.test("y", t => { t.beforeEach(() => ({a: 1})); }); });'),

		// Hooks
		typed('before(() => { return 1; });'),
		typed('after(() => { return "done"; });'),
		typed('beforeEach(() => { return {a: 1}; });'),
		typed('afterEach(() => { return [1, 2]; });'),
		typed('beforeEach(() => { return 1; }, {timeout: 1000});'),
		typed('beforeEach(() => ({a: 1}));'),
		typed('beforeEach((() => { return 1; }) as () => number);'),
		typed('beforeEach(() => { const value: Promise<void> | number = Math.random() > 0.5 ? Promise.resolve() : 1; return value; });'),

		// Default import member hook
		typed('test.beforeEach(() => { return 1; });'),

		// Named import member hook
		typedCode('import {test} from \'node:test\';\ntest.beforeEach(() => { return 1; }, {timeout: 1000});'),
		typedCode('import {it} from \'node:test\';\nit.beforeEach(() => { return 1; }, {timeout: 1000});'),

		// Namespace import hook
		typedCode('import * as nodeTest from \'node:test\';\nnodeTest.beforeEach(() => { return 1; });'),
		typedCode('import * as nodeTest from \'node:test\';\nnodeTest.test.beforeEach(() => { return 1; }, {timeout: 1000});'),

		// Renamed hook import
		typedCode('import {beforeEach as setup} from \'node:test\';\nsetup(() => { return 1; });'),
	],
});

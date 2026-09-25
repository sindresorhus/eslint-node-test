import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, describe, beforeEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// A trailing object after the options is ignored by the runner, so its `fn` never runs
		'import test from \'node:test\';\ntest("a", {fn() {}}, {fn() { if (c) { f(); } }});',
		// A helper declared inside a test that also has a subtest is still not a test body
		withImport('test("a", async t => { const h = () => { if (x) { f(); } }; h(); await t.test("b", () => {}); });'),

		// Not a test file
		'test("x", () => { if (a) { b(); } });',

		// No conditional
		withImport('test("x", () => { assert.ok(a); });'),

		// Conditional in a `describe` body is registration logic (no-conditional-tests covers it)
		withImport('describe("s", () => { if (a) { test("x", () => {}); } });'),

		// Conditional outside any test
		withImport('if (a) { b(); }\ntest("x", () => {});'),

		// Conditional in a test-deciding argument, not inside the test body
		withImport('test("x", a ? f : g);'),

		// Conditional in the options object, not inside the test body
		withImport('test("x", {skip: a ? "reason" : false}, () => {});'),

		// Conditional inside a nested helper function, not directly in the test body
		withImport('test("x", () => { const helper = () => { if (a) { f(); } }; helper(); });'),

		// Conditional in a hook's options object, not inside the hook body
		withImport('beforeEach(() => {}, {timeout: a ? 1 : 2});'),

		// A conditional in a nested call's argument slot is evaluated by the enclosing test, not by
		// the nested callback, exactly as at the top level
		withImport('test("outer", async t => { await t.test("x", {skip: a ? 1 : 2}, () => {}); });'),
		withImport('test("outer", t => { t.beforeEach(() => {}, {timeout: a ? 1 : 2}); });'),
		'import {test, getTestContext} from \'node:test\';\n'
		+ 'test("outer", () => { getTestContext().beforeEach(() => {}, {timeout: a ? 1 : 2}); });',
	],
	invalid: [
		// Only the options slot's `fn` runs, so a conditional in a trailing object's `fn` is dead code
		'import test from \'node:test\';\ntest("a", {fn() { if (c) { f(); } }}, {fn() {}});',
		// A subtest body is a test body, so a conditional there is just as much a problem
		withImport('test("a", async t => { await t.test("b", () => { if (x) { f(); } }); });'),
		withImport('test("a", async t => { await t.test.only("b", () => { if (x) { f(); } }); });'),
		withImport('test("a", async t => { await t.test("b", () => { const v = x ? 1 : 2; }); });'),

		// The object form body is a test body
		'import test from \'node:test\';\ntest({name: \'x\', fn() { if (a) { f(); } }});',

		// `if` in a test body
		withImport('test("x", () => { if (a) { assert.ok(b); } });'),

		// `if`/`else`
		withImport('test("x", () => { if (a) { f(); } else { g(); } });'),

		// Ternary in a test body
		withImport('test("x", () => { const value = a ? 1 : 2; });'),

		// `switch` in a test body
		withImport('test("x", () => { switch (a) { case 1: break; } });'),

		// Conditional in a hook body
		withImport('beforeEach(() => { if (a) { setup(); } });'),

		// A hook's trailing options must not hide its body
		withImport('beforeEach(() => { if (a) { setup(); } }, {timeout: 1000});'),
		'import {before} from \'node:test\';\nbefore(() => { if (a) { f(); } }, {timeout: 1});',
		'import {after} from \'node:test\';\nafter(() => { if (a) { f(); } }, {timeout: 1});',
		'import {afterEach} from \'node:test\';\nafterEach(() => { if (a) { f(); } }, {timeout: 1});',
		'import test from \'node:test\';\ntest.beforeEach(() => { if (a) { f(); } }, {timeout: 1});',
		withImport('beforeEach(() => { const value = a ? 1 : 2; }, {timeout: 1000});'),
		withImport('beforeEach(() => { switch (a) { case 1: break; } }, {timeout: 1000});'),

		// Conditional inside a nested describe -> test body
		withImport('describe("s", () => { test("x", () => { if (a) { f(); } }); });'),

		// `it` alias
		'import {it} from \'node:test\';\nit("x", () => { if (a) { f(); } });',

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test("x", () => { if (a) { f(); } });',

		// TypeScript
		{
			code: withImport('test("x", () => { if (a as boolean) { f(); } });'),
			languageOptions: {parser: parsers.typescript},
		},
		withImport('test(\'o\', t => { t.beforeEach(() => { if (a) { f(); } }); });'),
		withImport('test(\'o\', t => { t.before(() => { if (a) { f(); } }); });'),

		// `node:test` runs the first function argument and never calls the second, so only the first is a hook body
		withImport('beforeEach(function live() { if (a) { f(); } }, function dead() { g(); });'),
		withImport('test("a", function live() { if (a) { f(); } }, function dead() { g(); });'),

		// A hook declared through `getTestContext()` is the same hook
		'import {test, getTestContext} from \'node:test\';\ntest(\'p\', t => { getTestContext().beforeEach(() => { if (a) { f(); } }); });',
	],
});

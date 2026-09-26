import {getTester} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// Not a test file
		'test("title", () => { test("inner", () => {}); });',
		// Top-level tests (no nesting)
		'import test from "node:test";\ntest("a", () => {});\ntest("b", () => {});',
		// Tests inside a suite — the idiomatic way to group tests
		'import {describe, it} from "node:test";\ndescribe("group", () => {\n  it("a", () => {});\n  it("b", () => {});\n});',
		// Nested suites are valid
		'import {describe, it} from "node:test";\ndescribe("outer", () => {\n  describe("inner", () => {\n    it("a", () => {});\n  });\n});',
		// Hooks and tests inside a suite
		'import {describe, it, before} from "node:test";\ndescribe("group", () => {\n  before(() => {});\n  it("a", () => {});\n});',
		// `test` inside a suite is fine
		'import test, {describe} from "node:test";\ndescribe("group", () => {\n  test("inner", () => {});\n});',
		// Namespace import — suite grouping
		'import * as nodeTest from "node:test";\nnodeTest.describe("group", () => {\n  nodeTest.it("a", () => {});\n});',
		// No callback (no nesting possible)
		'import test from "node:test";\ntest("a");',
		// Hook inside a test body is not flagged by this rule
		'import test, {before} from "node:test";\ntest("a", () => {\n  before(() => {});\n});',
		// A bare `test` package is not Node's test runner.
		'import test from "test";\ntest("outer", () => {\n  test("inner", () => {});\n});',
		// A subtest is created through the context, not by a nested `test()` call.
		'import test from "node:test";\ntest("a", async t => {\n  await t.test("b", () => {});\n});',

		// A suite or a hook body named out of line holds tests and suites, exactly as its inline
		// spelling does
		'import {describe, test} from "node:test";\ndescribe("group", body);\nfunction body() {\n  test("inner", () => {});\n}',
		'import {describe, test} from "node:test";\ndescribe("group", body);\nfunction body() {\n  describe("nested", () => {});\n}',
		'import {beforeEach, test} from "node:test";\nbeforeEach(body);\nfunction body() {\n  test("inner", () => {});\n}',
		'import {after, test} from "node:test";\nafter(body);\nfunction body() {\n  test("inner", () => {});\n}',
	],
	invalid: [
		// A callback the call names out of line is still the test's body, wherever it is declared
		'import test from "node:test";\nconst body = () => {\n  test("inner", () => {});\n};\ntest("outer", body);',
		'import test from "node:test";\ntest("outer", body);\nfunction body() {\n  test("inner", () => {});\n}',
		'import {test, describe} from "node:test";\nconst body = () => {\n  describe("inner", () => {});\n};\ntest("outer", body);',
		'import test from "node:test";\nconst body = () => {\n  test("inner", () => {});\n};\ntest({name: "outer", fn: body});',

		// Basic nesting: test inside test
		'import test from "node:test";\ntest("outer", () => {\n  test("inner", () => {});\n});',
		// It inside test
		'import test, {it} from "node:test";\ntest("outer", () => {\n  it("inner", () => {});\n});',
		// Suite inside test
		'import test, {describe} from "node:test";\ntest("outer", () => {\n  describe("inner", () => {});\n});',
		// Multiple nested tests
		'import test from "node:test";\ntest("outer", () => {\n  test("inner1", () => {});\n  test("inner2", () => {});\n});',
		// It inside it
		'import {it} from "node:test";\nit("outer", () => {\n  it("inner", () => {});\n});',
		// Renamed import
		'import {test as myTest} from "node:test";\nmyTest("outer", () => {\n  myTest("inner", () => {});\n});',
		// Namespace import
		'import * as nodeTest from "node:test";\nnodeTest.test("outer", () => {\n  nodeTest.test("inner", () => {});\n});',
		// The outer test has options, so the callback is not the last argument
		'import test from "node:test";\ntest("outer", {timeout: 1}, () => {\n  test("inner", () => {});\n});',
		// A hook's trailing options must not hide a nested test in a test body
		'import test from "node:test";\ntest("outer", () => {\n  test("inner", {}, () => {});\n});',
		// The object descriptor form nests just the same
		'import {test} from "node:test";\ntest({name: "a", fn() {\n  test("b", () => {});\n}});',
		// A helper defined inside a test body still runs inside it
		'import test from "node:test";\ntest("outer", () => {\n  const register = () => { test("inner", () => {}); };\n  register();\n});',
		// A suite in a test body containing a test: the suite and the test are both reported
		'import test, {describe} from "node:test";\ntest("outer", () => {\n  describe("s", () => {\n    test("inner", () => {});\n  });\n});',

		// A subtest body named out of line is a test body too
		'import {test} from "node:test";\ntest("outer", async t => {\n  await t.test("b", body);\n});\nfunction body() {\n  test("inner", () => {});\n}',
	],
});

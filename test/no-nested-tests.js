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
	],
	invalid: [
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
		// Bare "test" module
		'import test from "test";\ntest("outer", () => {\n  test("inner", () => {});\n});',
	],
});

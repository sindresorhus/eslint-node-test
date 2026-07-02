import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// Not a test file
		'test("a", () => {}); test("a", () => {});',
		// Unique titles
		'import test from "node:test";\ntest("a", () => {});\ntest("b", () => {});',
		// Single test
		'import test from "node:test";\ntest("a", () => {});',
		// Dynamic titles — can't check statically
		// eslint-disable-next-line no-template-curly-in-string
		'import test from "node:test";\ntest(`test ${x}`, () => {});\ntest(`test ${x}`, () => {});',
		// Hooks — no title tracking
		'import {before, beforeEach} from "node:test";\nbefore(() => {});\nbefore(() => {});',
		// Same title in different describe scopes is valid
		'import test from "node:test";\nimport {describe} from "node:test";\ndescribe("suite a", () => { test("same", () => {}); });\ndescribe("suite b", () => { test("same", () => {}); });',
		// Same title at top-level and inside a describe is valid
		'import test from "node:test";\nimport {describe} from "node:test";\ntest("same", () => {});\ndescribe("suite", () => { test("same", () => {}); });',
		// Unique suite titles
		'import {describe} from "node:test";\ndescribe("a", () => {});\ndescribe("b", () => {});',
		// Named imports
		'import {it} from "node:test";\nit("a", () => {});\nit("b", () => {});',
		// Renamed import
		'import {test as t} from "node:test";\nt("a", () => {});\nt("b", () => {});',
	],
	invalid: [
		// Duplicate top-level titles
		'import test from "node:test";\ntest("a", () => {});\ntest("a", () => {});',
		// Duplicate with `it`
		'import {it} from "node:test";\nit("a", () => {});\nit("a", () => {});',
		// Duplicate suite titles
		'import {describe} from "node:test";\ndescribe("a", () => {});\ndescribe("a", () => {});',
		// Duplicate inside a describe scope
		'import test from "node:test";\nimport {describe} from "node:test";\ndescribe("suite", () => { test("same", () => {}); test("same", () => {}); });',
		// Mixed test/it with same title
		'import test from "node:test";\nimport {it} from "node:test";\ntest("a", () => {});\nit("a", () => {});',
		// A `describe` and a `test` sharing a title in the same scope is also a duplicate
		'import test, {describe} from "node:test";\ndescribe("a", () => {});\ntest("a", () => {});',
		// Template literal duplicates string literal
		'import test from "node:test";\ntest("a", () => {});\ntest(`a`, () => {});',
		// Renamed import
		'import {test as myTest} from "node:test";\nmyTest("a", () => {});\nmyTest("a", () => {});',
		// Namespace import
		'import * as nodeTest from "node:test";\nnodeTest.test("a", () => {});\nnodeTest.test("a", () => {});',
		// TypeScript
		{
			code: 'import test from "node:test";\ntest("a", () => {});\ntest("a", () => {});',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {describe, it, test, before, beforeEach, after, afterEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'it("a", () => {}); beforeEach(() => {});',

		// Hooks before tests
		withImport('beforeEach(() => {});\nit("a", () => {});'),
		withImport('before(() => {});\nbeforeEach(() => {});\nit("a", () => {});\nit("b", () => {});'),

		// Hooks at the top of a describe
		withImport('describe("s", () => {\n\tbeforeEach(() => {});\n\tit("a", () => {});\n});'),

		// Independent scopes
		withImport('describe("a", () => { beforeEach(() => {}); it("x", () => {}); });\ndescribe("b", () => { beforeEach(() => {}); it("y", () => {}); });'),

		// A hook inside an unrelated function shares no scope with the test above it, and a test
		// inside one shares no scope with a hook below it
		withImport('test("a", () => {});\nfunction helper() {\n\tbeforeEach(() => {});\n}'),
		withImport('test("a", () => {});\nconst helper = () => { beforeEach(() => {}); };'),
		withImport('function helper() {\n\ttest("a", () => {});\n}\nbeforeEach(() => {});'),
		withImport('const helper = () => { test("a", () => {}); };\nbeforeEach(() => {});'),
		withImport('function helper() {\n\ttest("a", () => {});\n}\nfunction other() {\n\tbeforeEach(() => {});\n}'),
		// A nested suite has its own order, so a test outside it says nothing about its hooks
		withImport('test("a", () => {});\ndescribe("s", () => {\n\tbeforeEach(() => {});\n\tit("b", () => {});\n});'),
		// A hook body opens no scope of its own, inline or named out of line, exactly as the inline spelling
		withImport('beforeEach(() => {\n\tit("a", () => {});\n\tbeforeEach(() => {});\n});'),
		withImport('function body() {\n\tit("a", () => {});\n\tbeforeEach(() => {});\n}\nbeforeEach(body);'),
		'import {test} from \'node:test\';\ntest(\'p\', t => {\n\tfunction body() {\n\t\tt.test(\'a\', () => {});\n\t\tt.beforeEach(() => {});\n\t}\n\tt.beforeEach(body);\n});',
	],
	invalid: [
		// A suite callback the call names out of line is that suite's own scope, so a hook after a
		// test in it is still out of order
		'import {describe, it, beforeEach} from \'node:test\';\nconst body = () => {\n\tit(\'a\', () => {});\n\tbeforeEach(() => {});\n};\ndescribe(\'user\', body);',
		'import {describe, it, beforeEach} from \'node:test\';\ndescribe(\'user\', body);\nfunction body() {\n\tit(\'a\', () => {});\n\tbeforeEach(() => {});\n}',

		// Hook after a test at the top level
		withImport('it("a", () => {});\nbeforeEach(() => {});'),

		// Hook after a test inside a describe
		withImport('describe("s", () => {\n\tit("a", () => {});\n\tbeforeEach(() => {});\n});'),

		// Hook between tests
		withImport('it("a", () => {});\nafterEach(() => {});\nit("b", () => {});'),

		// Hook after a nested describe
		withImport('describe("s", () => {});\nbefore(() => {});'),
		withImport('describe("outer", () => { describe("inner", () => {}); after(() => {}); });'),

		// Two hooks out of order, one after each of two tests
		withImport('test("a", () => {});\nafter(() => {});\ntest("b", () => {});\nbefore(() => {});'),

		// A hook declared on the `test` binding is the same hook
		'import test from \'node:test\';\ntest("a", () => {});\ntest.beforeEach(() => {});',

		// Inner-scope violation only (outer hook is fine)
		withImport('beforeEach(() => {});\ndescribe("s", () => {\n\tit("a", () => {});\n\tafter(() => {});\n});'),

		// TypeScript
		{
			code: withImport('it("a", () => {});\nbeforeEach((): void => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		// A subtest is a test and a context hook is a hook
		'import {test} from \'node:test\';\ntest(\'p\', t => { t.test(\'a\', () => {}); t.beforeEach(() => {}); });',

		// A hook declared through `getTestContext()` after a subtest is still out of order
		'import {test, getTestContext} from \'node:test\';\ntest(\'a\', t => { t.test(\'s\', () => {}); getTestContext().beforeEach(() => {}); });',
	],
});

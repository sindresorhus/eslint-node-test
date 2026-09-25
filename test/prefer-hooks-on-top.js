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
	],
	invalid: [
		// Hook after a test at the top level
		withImport('it("a", () => {});\nbeforeEach(() => {});'),

		// Hook after a test inside a describe
		withImport('describe("s", () => {\n\tit("a", () => {});\n\tbeforeEach(() => {});\n});'),

		// Hook between tests
		withImport('it("a", () => {});\nafterEach(() => {});\nit("b", () => {});'),

		// Hook after a nested describe
		withImport('describe("s", () => {});\nbefore(() => {});'),

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

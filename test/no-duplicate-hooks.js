import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {describe, before, after, beforeEach, afterEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'before(() => {}); before(() => {});',

		// Each hook once at the top level
		withImport('before(() => {});\nafter(() => {});\nbeforeEach(() => {});\nafterEach(() => {});'),

		// Same hook name, but in different (nested) scopes
		withImport('beforeEach(() => {});\ndescribe("a", () => { beforeEach(() => {}); });'),

		// Sibling describes each with their own hook
		withImport('describe("a", () => { before(() => {}); });\ndescribe("b", () => { before(() => {}); });'),
	],
	invalid: [
		// Duplicate at the top level
		withImport('before(() => {});\nbefore(() => {});'),

		// Duplicate beforeEach
		withImport('beforeEach(() => {});\nbeforeEach(() => {});'),

		// Three of the same — two duplicates reported
		withImport('after(() => {});\nafter(() => {});\nafter(() => {});'),

		// Duplicate inside a describe
		withImport('describe("a", () => {\n\tbeforeEach(() => {});\n\tbeforeEach(() => {});\n});'),

		// Duplicate in nested describe only (outer is fine)
		withImport('before(() => {});\ndescribe("a", () => {\n\tafter(() => {});\n\tafter(() => {});\n});'),

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.before(() => {});\nnodeTest.before(() => {});',

		// TypeScript
		{
			code: withImport('before((): void => {});\nbefore((): void => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

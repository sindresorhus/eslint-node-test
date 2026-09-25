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

		// Sibling subtests are separate scopes, so a `beforeEach` in each is independent
		'import {test, beforeEach} from \'node:test\';\n'
		+ 'test(\'p\', async t => {\n'
		+ '\tawait t.test(\'one\', async one => { beforeEach(() => {}); });\n'
		+ '\tawait t.test(\'two\', async two => { beforeEach(() => {}); });\n'
		+ '});',
	],
	invalid: [
		// Duplicate at the top level
		withImport('before(() => {});\nbefore(() => {});'),

		// Duplicate beforeEach
		withImport('beforeEach(() => {});\nbeforeEach(() => {});'),

		// A hook's trailing options must not make the two calls look different
		withImport('beforeEach(() => {});\nbeforeEach(() => {}, {timeout: 1});'),
		withImport('before(() => {});\nbefore(() => {}, {timeout: 1});'),

		// Three of the same — two duplicates reported
		withImport('after(() => {});\nafter(() => {});\nafter(() => {});'),

		// Duplicate inside a describe
		withImport('describe("a", () => {\n\tbeforeEach(() => {});\n\tbeforeEach(() => {});\n});'),

		// Duplicate in nested describe only (outer is fine)
		withImport('before(() => {});\ndescribe("a", () => {\n\tafter(() => {});\n\tafter(() => {});\n});'),

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.before(() => {});\nnodeTest.before(() => {});',

		// Renamed import — canonicalised back to `before`
		'import {before as setup} from \'node:test\';\nsetup(() => {});\nsetup(() => {});',

		// TypeScript
		{
			code: withImport('before((): void => {});\nbefore((): void => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		// A hook declared on a test context is a real hook
		'import {test} from \'node:test\';\ntest(\'p\', t => { t.beforeEach(() => {}); t.beforeEach(() => {}); });',
		// A duplicate inside a subtest body is still a duplicate
		'import {test, beforeEach} from \'node:test\';\ntest(\'p\', async t => { t.test(\'a\', () => { beforeEach(() => {}); beforeEach(() => {}); }); });',
	],
});

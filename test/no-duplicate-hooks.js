import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {describe, before, after, beforeEach, afterEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'before(() => {}); before(() => {});',

		// A callback the call names out of line is that suite's own scope, so one hook in each of two
		// such suites is not a duplicate
		'import {describe, before} from \'node:test\';\nconst d1 = () => { before(() => {}); };\nconst d2 = () => { before(() => {}); };\ndescribe(\'a\', d1);\ndescribe(\'b\', d2);',
		'import {describe, before} from \'node:test\';\nconst d1 = () => { before(() => {}); };\ndescribe(\'a\', d1);\ndescribe(\'b\', d1);',

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

		// A hook body is a scope of its own. Its `t` is the context of the test the hook runs for, so a
		// hook declared on it belongs to that test's subtests, not to the scope it was declared in.
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.beforeEach(() => {}); });',
		// A context hook in a test body belongs to that test's scope, not to the file's
		'import {before, test} from \'node:test\';\ntest(\'a\', t => { t.before(() => {}); });\nbefore(() => {});',
	],
	invalid: [
		// The same hook twice inside one out-of-line suite body is still a duplicate
		'import {describe, before} from \'node:test\';\nconst d1 = () => { before(() => {}); before(() => {}); };\ndescribe(\'a\', d1);',
		'import {describe, before} from \'node:test\';\nfunction d1() { before(() => {}); before(() => {}); }\ndescribe(\'a\', d1);',
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

		// A hook declared through `getTestContext()` is the same hook
		'import {test, getTestContext} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'a\', () => { getTestContext().beforeEach(() => {}); getTestContext().beforeEach(() => {}); }); });',

		// An imported hook and a context hook of the same name share one scope
		'import {test, beforeEach} from \'node:test\';\ntest(\'p\', t => { beforeEach(() => {}); t.beforeEach(() => {}); });',
		'import {test, afterEach} from \'node:test\';\ntest(\'p\', t => { afterEach(() => {}); t.afterEach(() => {}); });',

		// A subtest with no callback opens no scope, so the hooks stay in the parent test body
		'import {test, before} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'a\'); before(() => {}); before(() => {}); });',
	],
});

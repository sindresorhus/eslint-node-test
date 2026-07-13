import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const head = 'import {test, mock} from \'node:test\';\n';

test.snapshot({
	valid: [
		// Not a test file
		'import value from \'module.js\';\nmock.module(\'module.js\');',
		'import {mock} from \'test\';\nimport \'module.js\';\nmock.module(\'module.js\');',

		// Different module
		head + 'import value from \'module.js\';\nmock.module(\'other-module.js\');',
		'import {mock} from \'node:test\';\nimport \'node:fs\';\nmock.module(\'fs\');',

		// Dynamic imports happen after the mock is installed.
		head + 'test(\'mock\', async t => {\n\tt.mock.module(\'module.js\');\n\tawait import(\'module.js\');\n});',

		// Dynamic specifier
		head + 'import value from \'module.js\';\nmock.module(moduleName);',
		head + 'import value from \'module.js\';\nmock.module(new URL(\'module.js\', import.meta.url));',

		// Computed and aliased mocks are intentionally ignored.
		head + 'import value from \'module.js\';\nmock[\'module\'](\'module.js\');',
		head + 'import value from \'module.js\';\nconst moduleMock = mock;\nmoduleMock.module(\'module.js\');',

		// Lookalike mock
		head + 'import value from \'module.js\';\nlocalMock.module(\'module.js\');',

		// Shadowed mock
		head + 'import value from \'module.js\';\nfunction helper(mock) {\n\tmock.module(\'module.js\');\n}',

		// TypeScript type-only imports do not create runtime module references.
		{
			code: head + 'import type Value from \'module.js\';\nmock.module(\'module.js\');',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: head + 'import {type Value} from \'module.js\';\nmock.module(\'module.js\');',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import type {mock} from \'node:test\';\nimport \'module.js\';\nmock.module(\'module.js\');',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {type mock} from \'node:test\';\nimport \'module.js\';\nmock.module(\'module.js\');',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import type {getTestContext} from \'node:test\';\nimport \'module.js\';\ngetTestContext().mock.module(\'module.js\');',
			languageOptions: {parser: parsers.typescript},
		},
		'import {getTestContext} from \'node:test\';\nimport \'module.js\';\nfunction helper(getTestContext) {\n\tgetTestContext().mock.module(\'module.js\');\n}',
		'import * as nodeTest from \'node:test\';\nimport \'module.js\';\nfunction helper(nodeTest) {\n\tnodeTest.getTestContext().mock.module(\'module.js\');\n}',

		// Context mock aliases and shadowed context names are intentionally ignored.
		head + 'import \'module.js\';\ntest(\'mock\', t => {\n\tconst moduleMock = t.mock;\n\tmoduleMock.module(\'module.js\');\n});',
		head + 'import \'module.js\';\ntest(\'mock\', t => {\n\tfunction helper(t) {\n\t\tt.mock.module(\'module.js\');\n\t}\n});',
	],
	invalid: [
		// Default, named, namespace, and side-effect imports.
		head + 'import value from \'module.js\';\nmock.module(\'module.js\');',
		head + 'import {value} from \'module.js\';\nmock.module(\'module.js\');',
		head + 'import * as module from \'module.js\';\nmock.module(\'module.js\');',
		head + 'import \'module.js\';\nmock.module(\'module.js\');',
		head + 'import {} from \'module.js\';\nmock.module(\'module.js\');',
		head + 'mock.module(\'module.js\');\nimport \'module.js\';',

		// Static mock specifiers.
		head + 'import \'module.js\';\nmock.module(`module.js`);',
		head + 'import \'module.js\';\nconst moduleName = \'module.js\';\nmock.module(moduleName);',

		// Global mock aliases.
		'import {mock as moduleMock} from \'node:test\';\nimport \'module.js\';\nmoduleMock.module(\'module.js\');',
		'import * as nodeTest from \'node:test\';\nimport \'module.js\';\nnodeTest.mock.module(\'module.js\');',
		'import test from \'node:test\';\nimport \'module.js\';\ntest.mock.module(\'module.js\');',
		'import {test} from \'node:test\';\nimport \'module.js\';\ntest.mock.module(\'module.js\');',
		'import {it} from \'node:test\';\nimport \'module.js\';\nit.mock.module(\'module.js\');',

		// Context-only mocks.
		'import {test} from \'node:test\';\nimport \'module.js\';\ntest(\'mock\', t => {\n\tt.mock.module(\'module.js\');\n});',
		'import {test} from \'node:test\';\nimport \'module.js\';\ntest(\'mock\', (t = fallback) => {\n\tt.mock.module(\'module.js\');\n});',
		'import {getTestContext} from \'node:test\';\nimport \'module.js\';\ngetTestContext().mock.module(\'module.js\');',
		'import {getTestContext as context} from \'node:test\';\nimport \'module.js\';\ncontext().mock.module(\'module.js\');',
		'import * as nodeTest from \'node:test\';\nimport \'module.js\';\nnodeTest.getTestContext().mock.module(\'module.js\');',
		'import * as nodeTest from \'node:test\';\nimport \'module.js\';\nnodeTest.test(\'mock\', context => {\n\tcontext.mock.module(\'module.js\');\n});',
		{
			code: 'import {getTestContext} from \'node:test\';\nimport \'module.js\';\n(getTestContext() as TestContext).mock.module(\'module.js\');',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {getTestContext} from \'node:test\';\nimport \'module.js\';\ngetTestContext()!.mock.module(\'module.js\');',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {getTestContext} from \'node:test\';\nimport \'module.js\';\n(getTestContext as typeof getTestContext)().mock.module(\'module.js\');',
			languageOptions: {parser: parsers.typescript},
		},
		// Subtest and hook context mocks.
		head + 'import \'module.js\';\ntest(\'outer\', t => {\n\tt.test(\'inner\', context => {\n\t\tcontext.mock.module(\'module.js\');\n\t});\n});',
		'import {beforeEach} from \'node:test\';\nimport \'module.js\';\nbeforeEach(t => {\n\tt.mock.module(\'module.js\');\n});',
		head + 'import \'module.js\';\ntest(\'outer\', t => {\n\tt.beforeEach(context => {\n\t\tcontext.mock.module(\'module.js\');\n\t});\n});',

		// TypeScript runtime imports still count.
		{
			code: head + 'import {type Type, value} from \'module.js\';\nmock.module(\'module.js\' as string);',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: head + 'import \'module.js\';\n(mock as typeof mock).module(\'module.js\');',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from \'node:test\';\nimport \'module.js\';\n(test as typeof test).mock.module(\'module.js\');',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: head + 'import \'module.js\';\ntest(\'mock\', t => {\n\t(t as TestContext).mock.module(\'module.js\');\n});',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

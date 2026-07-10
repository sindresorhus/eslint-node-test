import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Reason strings and matcher values are intentional expected failures.
		withTest('test(\'t\', {expectFailure: \'tracked in #123\'}, () => {});'),
		withTest('test(\'t\', {expectFailure: /expected error/}, () => {});'),
		withTest('test(\'t\', {expectFailure: error => error.code === \'ERR_EXPECTED\'}, () => {});'),
		withTest('test(\'t\', {expectFailure: new Error(\'expected error\')}, () => {});'),
		withTest('test(\'t\', {expectFailure: {code: \'ERR_EXPECTED\'}}, () => {});'),
		withTest('test(\'t\', {expectFailure: {label: \'tracked in #123\', match: /expected error/}}, () => {});'),

		// Values other than literal `true` are out of scope.
		withTest('test(\'t\', {expectFailure: false}, () => {});'),
		withTest('test(\'t\', {expectFailure: undefined}, () => {});'),
		withTest('test(\'t\', {expectFailure: shouldExpectFailure}, () => {});'),
		withTest('test(\'t\', {expectFailure: \'\'}, () => {});'),

		// The last option property determines the effective value.
		withTest('test(\'t\', {expectFailure: true, expectFailure: \'tracked in #123\'}, () => {});'),
		withTest('test(\'t\', {expectFailure: true, ...options}, () => {});'),
		withTest('test(\'t\', {expectFailure: true, [key]: value}, () => {});'),

		// The chained form has no inline reason mechanism, so it is out of scope.
		withTest('test.expectFailure(\'t\', () => {});'),
		withTest('test.expectFailure(\'t\', {expectFailure: true}, () => {});'),

		// Hooks do not support `expectFailure`.
		'import {beforeEach} from \'node:test\';\nbeforeEach({expectFailure: true}, () => {});',

		// Computed and spread properties cannot be checked statically.
		withTest('test(\'t\', {[\'expectFailure\']: true}, () => {});'),
		withTest('test(\'t\', {...options}, () => {});'),

		// Not a test file.
		'test(\'t\', {expectFailure: true}, () => {});',

		// Not a `node:test` test/suite modifier.
		withTest('test.foo(\'t\', {expectFailure: true}, () => {});'),
	],
	invalid: [
		// Default import.
		withTest('test(\'t\', {expectFailure: true}, () => {});'),
		withTest('test({expectFailure: true}, () => {});'),
		withTest('test(\'t\', {expectFailure: \'tracked in #123\', expectFailure: true}, () => {});'),
		withTest('test(\'t\', {...options, expectFailure: true}, () => {});'),
		withTest('test(\'t\', {expectFailure: true, timeout: 1000}, () => {});'),
		withTest('test.only(\'t\', {expectFailure: true}, () => {});'),

		// Named/renamed import.
		'import {it as check} from \'node:test\';\ncheck(\'t\', {expectFailure: true}, () => {});',

		// Suite.
		'import {suite} from \'node:test\';\nsuite(\'s\', {expectFailure: true}, () => {});',

		// Namespace import.
		'import * as nodeTest from \'node:test\';\nnodeTest.test(\'t\', {expectFailure: true}, () => {});',

		// String-literal option key.
		withTest('test(\'t\', {\'expectFailure\': true}, () => {});'),

		// A TypeScript-wrapped `true` still needs a reason.
		{
			code: withTest('test(\'t\', {expectFailure: true as boolean}, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withTest('test(\'t\', ({expectFailure: true} as object), () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

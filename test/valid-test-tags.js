import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {Linter} from 'eslint';
import {getTester, parsers} from './utils/test.js';

const {ruleId, rule, test} = getTester(import.meta);

const withImport = code => `import {test, it, describe, suite, before} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'test("title", {tags: ["UPPERCASE"]}, () => {});',

		// Valid tag arrays
		withImport('test("title", {tags: []}, () => {});'),
		withImport('test("title", {tags: ["unit", "slow", " "]}, () => {});'),
		withImport('test("title", {tags: ["UPPER"], tags: ["unit"]}, () => {});'),
		withImport('test("title", {tags: ["UPPER"], ...{tags: ["unit"]}}, () => {});'),
		withImport('test("title", {tags: ["unit"], ...{tags: ["UPPER"]}}, () => {});'),
		withImport('test("title", {tags: ["UPPER"], ["tags"]: ["unit"]}, () => {});'),
		withImport('it("title", {tags: ["unit"]}, () => {});'),
		withImport('describe("title", {tags: ["unit"]}, () => {});'),
		withImport('suite("title", {tags: ["unit"]}, () => {});'),

		// Dynamic values cannot be checked statically
		withImport('test("title", {tags}, () => {});'),
		withImport('test("title", {tags: getTags()}, () => {});'),
		withImport('test("title", {tags: [...tagNames]}, () => {});'),
		// eslint-disable-next-line no-template-curly-in-string
		withImport('test("title", {tags: [`tag-${name}`]}, () => {});'),

		// Hooks do not support tags
		withImport('before({tags: ["UPPERCASE"]}, () => {});'),

		// Renamed and namespace imports
		'import {test as nodeTest} from \'node:test\';\nnodeTest("title", {tags: ["unit"]}, () => {});',
		'import * as nodeTest from \'node:test\';\nnodeTest.describe("title", {tags: ["unit"]}, () => {});',

		// TypeScript wrappers
		{
			code: withImport('test("title", {tags: ["unit" as const]} as const, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Non-array values
		withImport('test("title", {tags: "unit"}, () => {});'),
		withImport('test("title", {tags: null}, () => {});'),
		withImport('test("title", {tags: {}}, () => {});'),
		withImport('test("title", {tags: -1}, () => {});'),
		withImport('test("title", {tags: +1}, () => {});'),
		withImport('test("title", {tags: -1n}, () => {});'),

		// Invalid array values
		withImport('test("title", {tags: ["unit", 1, true, {}, null]}, () => {});'),
		withImport('test("title", {tags: ["unit", -1, -1n]}, () => {});'),
		withImport('test("title", {tags: ["unit", , "slow"]}, () => {});'),
		withImport('test("title", {tags: [""]}, () => {});'),
		withImport('test("title", {tags: [``]}, () => {});'),

		// Lowercase canonical form
		withImport('test("title", {tags: ["UNIT"]}, () => {});'),
		withImport('test("title", {tags: ["unit"], tags: ["UPPER"]}, () => {});'),
		withImport('test("title", {...options, tags: ["UPPER"]}, () => {});'),
		withImport('test("title", {["tags"]: ["unit"], tags: ["UPPER"]}, () => {});'),
		withImport('test("title", {"tags": ["UPPER"]}, () => {});'),
		withImport('test("title", {tags: [`SLOW`]}, () => {});'),
		withImport('test("title", {tags: ["ÜNICODE"]}, () => {});'),
		withImport('test("title", {tags: [/* tag */ "UPPER"]}, () => {});'),

		// Duplicates are matched case-insensitively
		withImport('test("title", {tags: ["unit", "unit"]}, () => {});'),
		withImport('test("title", {tags: ["UNIT", "unit"]}, () => {});'),

		// TypeScript wrappers around the array and element
		{
			code: withImport('test("title", {tags: ["UNIT" as string] as string[]}, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('test("title", {tags: ["UPPER" satisfies string]!}, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('test("title", {tags: -(1 as number)}, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

nodeTest('lowercase fixes keep duplicate diagnostics', () => {
	const linter = new Linter();
	const result = linter.verifyAndFix(
		'import test from \'node:test\';\ntest("title", {tags: ["UNIT", "unit"]}, () => {});',
		{
			files: ['**'],
			languageOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
			plugins: {
				'rule-to-test': {
					rules: {
						[ruleId]: rule,
					},
				},
			},
			rules: {
				[`rule-to-test/${ruleId}`]: 'error',
			},
		},
	);

	assert.strictEqual(
		result.output,
		'import test from \'node:test\';\ntest("title", {tags: ["unit", "unit"]}, () => {});',
	);
	assert.deepStrictEqual(result.messages.map(message => message.messageId), ['valid-test-tags/duplicate']);
});

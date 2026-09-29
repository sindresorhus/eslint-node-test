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
		withImport('test("title", {tags: ["UPPER"], tags: ["unit"]}, () => {});'),
		withImport('test("title", {tags: ["UPPER"], ...{tags: ["unit"]}}, () => {});'),
		withImport('test("title", {tags: ["unit"], ...{tags: ["UPPER"]}}, () => {});'),
		withImport('test("title", {tags: ["UPPER"], ["tags"]: ["unit"]}, () => {});'),
		// A later computed key that does not fold could be `tags`
		withImport('test("title", {tags: ["UPPER"], [key]: 5}, () => {});'),
		withImport('test("title", {get tags() { return ["UPPER"]; }}, () => {});'),
		withImport('test("title", {tags: ["UPPER"], get tags() { return ["unit"]; }}, () => {});'),
		withImport('test.foo("title", {tags: ["UPPER"]}, () => {});'),
		withImport('test.only.skip("title", {tags: ["UPPER"]}, () => {});'),
		'import * as nodeTest from \'node:test\';\nnodeTest.test.foo("title", {tags: ["UPPER"]}, () => {});',
		withImport('it("title", {tags: ["unit"]}, () => {});'),
		withImport('describe("title", {tags: ["unit"]}, () => {});'),
		withImport('suite("title", {tags: ["unit"]}, () => {});'),

		// Dynamic values cannot be checked statically
		withImport('test("title", {tags}, () => {});'),
		withImport('test("title", {tags: getTags()}, () => {});'),
		withImport('test("title", {tags: [...tagNames]}, () => {});'),
		// eslint-disable-next-line no-template-curly-in-string
		withImport('test("title", {tags: [`tag-${name}`]}, () => {});'),
		withImport('test("title", {tags: [tagName]}, () => {});'),
		// A unary tag list is not a static value the rule reads, so it is not reported as non-array
		withImport('test("title", {tags: -[name]}, () => {});'),

		// An object past the callback is never read, so its `tags` is not the test's
		withImport('test("title", () => {}, {tags: ["UPPER"]});'),

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

		// `node:test` rejects six whitespace code points, not every Unicode space: a non-breaking space and the other Unicode spaces are accepted.
		'import {test} from \'node:test\';\ntest(\'title\', {tags: [\'a\\u00a0b\']}, () => {});',
		'import {test} from \'node:test\';\ntest(\'title\', {tags: [\'a\\u2028b\']}, () => {});',
		'import {test} from \'node:test\';\ntest(\'title\', {tags: [\'a\\u3000b\']}, () => {});',
	],
	invalid: [
		// Non-array values
		withImport('test("title", {tags: "unit"}, () => {});'),
		withImport('test("title", {tags: `unit`}, () => {});'),
		withImport('test("title", {tags: null}, () => {});'),
		withImport('test("title", {tags: {}}, () => {});'),
		withImport('test("title", {tags: -1}, () => {});'),
		withImport('test("title", {tags: +1}, () => {});'),
		withImport('test("title", {tags: -1n}, () => {});'),
		withImport('test("title", {tags: () => {}}, () => {});'),

		// Invalid array values
		withImport('test("title", {tags: ["unit", 1, true, {}, null]}, () => {});'),
		withImport('test("title", {tags: ["unit", -1, -1n]}, () => {});'),
		withImport('test("title", {tags: [function () {}, class {}]}, () => {});'),
		withImport('test("title", {tags: ["unit", , "slow"]}, () => {});'),
		withImport('test("title", {tags: [""]}, () => {});'),
		withImport('test("title", {tags: [``]}, () => {});'),

		// Lowercase canonical form
		withImport('test("title", {tags: ["UNIT"]}, () => {});'),
		withImport('test.expectFailure("title", {tags: ["UPPER"]}, () => {});'),
		withImport('test.only("title", {tags: ["UPPER"]}, () => {});'),
		withImport('describe.skip("title", {tags: ["UPPER"]}, () => {});'),
		withImport('describe.expectFailure("title", {tags: ["UPPER"]}, () => {});'),
		'import * as nodeTest from \'node:test\';\nnodeTest.test.only("title", {tags: ["UPPER"]}, () => {});',
		'import * as nodeTest from \'node:test\';\nnodeTest.test.expectFailure("title", {tags: ["UPPER"]}, () => {});',
		'import * as nodeTest from \'node:test\';\nnodeTest.suite.expectFailure("title", {tags: ["UPPER"]}, () => {});',
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
			code: withImport('test("title", {tags: <string[]>["UPPER"]}, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('test("title", {tags: -(1 as number)}, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'a\', {tags: [\'Slow\', \'slow\']}, () => {}); });',

		// A tag with whitespace or a tag-filter operator character makes `test()` throw
		withImport('test("title", {tags: [\'a b\']}, () => {});'),
		withImport(String.raw`test("title", {tags: ['a\tb']}, () => {});`),
		// The other whitespace code points `node:test` rejects, which `\s` would also have caught. A carriage return is left out on purpose: it cannot survive the snapshot file round trip.
		withImport(String.raw`test("title", {tags: ['a\nb']}, () => {});`),
		withImport(String.raw`test("title", {tags: ['a\vb']}, () => {});`),
		withImport(String.raw`test("title", {tags: ['a\fb']}, () => {});`),
		withImport('test("title", {tags: [\' a\']}, () => {});'),
		withImport('test("title", {tags: [\'a&b\']}, () => {});'),
		withImport('test("title", {tags: [\'a|b\']}, () => {});'),
		withImport('test("title", {tags: [\'a!b\']}, () => {});'),
		withImport('test("title", {tags: [\'a(b\']}, () => {});'),
		withImport('test("title", {tags: [\'a)b\']}, () => {});'),
		withImport('test("title", {tags: [\'a*b\']}, () => {});'),
		withImport('describe("title", {tags: [\'a b\']}, () => {});'),
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'a\', {tags: [\'a b\']}, () => {}); });',

		// A whitespace-only tag is not empty, but it still contains a forbidden character
		withImport('test("title", {tags: ["unit", "slow", " "]}, () => {});'),

		// `and`, `or` and `not` are reserved by the tag filter in any casing
		withImport('test("title", {tags: [\'and\']}, () => {});'),
		withImport('test("title", {tags: [\'or\']}, () => {});'),
		withImport('test("title", {tags: [\'not\']}, () => {});'),
		// Lowercasing a reserved word would only produce another reserved word, so there is no fix
		withImport('test("title", {tags: [\'AND\']}, () => {});'),
		withImport('test("title", {tags: [\'OR\']}, () => {});'),
		withImport('test("title", {tags: [\'Not\']}, () => {});'),
		// A reserved word is reported as itself twice over, never as a lowercase-and-duplicate pair: the reserved check comes first and returns, so it never reaches the tag list
		withImport('test("title", {tags: [\'not\', \'not\']}, () => {});'),
		// The same for an empty tag, which is reported on the node itself and never collected
		withImport('test("title", {tags: ["", ""]}, () => {});'),

		// The object-descriptor form reads its `tags` from the first argument
		withImport('test({name: "title", tags: ["UPPER"], fn() {}});'),
		withImport('it({name: "title", tags: ["UPPER"], fn() {}});'),
		withImport('suite({name: "title", tags: ["UPPER"], fn() {}});'),
		withImport('test({name: "title", tags: "UPPER"});'),
		'import {test} from \'node:test\';\ntest(\'p\', t => { t.test({name: \'a\', tags: [\'UPPER\']}); });',

		// A spread proves nothing about its own slot, so the entries around it are still checked
		withImport('test("title", {tags: [...base, "UPPER"]}, () => {});'),
		withImport('test("title", {tags: ["unit", ...base, "UNIT"]}, () => {});'),

		// The lowercase fix keeps the tag's own quoting, escaping what it has to
		withImport('test("title", {tags: [\'UPPER\']}, () => {});'),
		withImport(String.raw`test("title", {tags: ['UP\'PER']}, () => {});`),

		// A nested array is a static value that is not a string
		withImport('test("title", {tags: [["unit"]]}, () => {});'),

		// A later computed key that folds to a constant names another option, so it cannot override `tags`
		withImport('test("title", {tags: ["UPPER"], ["timeout"]: 5}, () => {});'),
		// A subtest registered in a hook is a real test, and its tags are checked at registration too
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.test(\'a\', {tags: [\'a b\']}); });',
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

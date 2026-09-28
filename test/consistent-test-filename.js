import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {Linter} from 'eslint';
import {getTester, parsers} from './utils/test.js';

const {ruleId, rule, test} = getTester(import.meta);

const withImport = code => `import {test} from 'node:test';\n${code}`;
const code = withImport('test("x", () => {});');

test.snapshot({
	valid: [
		// Not a test file — not checked even with a non-matching name
		{code: 'const a = 1;', filename: 'helpers.js'},

		// Virtual files (linting stdin) have no real name to check
		{code, filename: '<text>'},
		{code, filename: '<input>'},

		// Matching the default pattern
		{code, filename: 'foo.test.js'},
		{code, filename: '/project/src/foo.test.js'},
		{code, filename: 'foo.test.ts'},
		{code, filename: 'foo.test.mjs'},
		{code, filename: 'foo.test.tsx'},

		// A Windows path is split on the backslash too
		{code, filename: String.raw`C:\project\src\foo.test.js`},

		// Custom pattern
		{code, filename: 'foo-test.js', options: [{pattern: String.raw`-test\.js$`}]},

		// The pattern is an unanchored search, not a full match
		{code, filename: 'test-helpers.js', options: [{pattern: 'test'}]},

		// The pattern is compiled with the `v` flag, so a `-`, `(` or `)` in a class has to be escaped
		{code, filename: 'foo.test.js', options: [{pattern: String.raw`[\w.\-]+\.test\.js$`}]},
		{code, filename: 'foo.test.js', options: [{pattern: String.raw`[\(\)]?[\w]+\.test\.js$`}]},

		// A `#` or `,` outside a class needs no escape
		{code, filename: '#foo.test.js', options: [{pattern: String.raw`^#foo\.test\.js$`}]},
		{code, filename: 'foo,bar.test.js', options: [{pattern: String.raw`^foo,bar\.test\.js$`}]},

		// A Unicode property escape works
		{code, filename: 'F.test.js', options: [{pattern: String.raw`^\p{Lu}\w*\.test\.js$`}]},
	],
	invalid: [
		// Missing `.test.` segment
		{code, filename: 'foo.js'},
		{code, filename: '/project/src/foo.js'},

		// `-test` does not match the default pattern
		{code, filename: 'foo-test.js'},

		// Spec-style name does not match the default pattern
		{code, filename: 'foo.spec.js'},

		// `test.js` is a discovery pattern, but the default pattern requires a `.test.` segment
		{code, filename: 'test.js'},

		// Custom pattern not satisfied
		{code, filename: 'foo.test.js', options: [{pattern: String.raw`\.spec\.js$`}]},

		// Namespace import still marks the file as a test file
		{code: 'import * as nodeTest from \'node:test\';\nnodeTest.test("x", () => {});', filename: 'foo.js'},

		// TypeScript
		{
			code: withImport('test("x", (): void => {});'),
			filename: 'foo.js',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

nodeTest('a pattern the `v` flag rejects is an invalid option', () => {
	// An unescaped `-` or `(` in a class and an identity escape such as `\_` are valid without a flag, but not with `v`
	for (const pattern of [String.raw`[\w.-]+\.test\.js$`, String.raw`[()]?\w+\.test\.js$`, String.raw`^my\_file\.test\.js$`]) {
		assert.throws(
			() => {
				new Linter().verify(code, {
					plugins: {'rule-to-test': {rules: {[ruleId]: rule}}},
					rules: {[`rule-to-test/${ruleId}`]: ['error', {pattern}]},
				}, {filename: 'foo.test.js'});
			},
			{message: /Invalid `pattern` option for `consistent-test-filename`/},
		);
	}
});

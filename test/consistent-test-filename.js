import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

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

		// A character class that is valid in a plain regular expression must not crash the rule.
		// The `v` flag rejects the unescaped `.`/`-` in a class and the bare `(`/`)` in one.
		{code, filename: 'foo.test.js', options: [{pattern: String.raw`[\w.-]+\.test\.js$`}]},
		{code, filename: 'foo.test.js', options: [{pattern: String.raw`[\w-]+\.test\.js$`}]},
		{code, filename: 'foo.test.js', options: [{pattern: String.raw`[()]?[\w]+\.test\.js$`}]},
		{code, filename: 'foo.test.js', options: [{pattern: String.raw`[-a]*[\w]+\.test\.js$`}]},

		// An identity escape is valid in a plain regular expression and must not crash the rule.
		// `u` rejects `\u005f`, so the pattern is retried unflagged.
		{code, filename: 'my_file.test.js', options: [{pattern: String.raw`^my\_file\.test\.js$`}]},
		{code, filename: '#foo.test.js', options: [{pattern: String.raw`^#foo\.test\.js$`}]},
		{code, filename: 'foo,bar.test.js', options: [{pattern: String.raw`^foo,bar\.test\.js$`}]},
		{code, filename: 'foo bar.test.js', options: [{pattern: String.raw`^foo\ bar\.test\.js$`}]},

		// A Unicode property escape still works, which is the reason for a unicode flag at all
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

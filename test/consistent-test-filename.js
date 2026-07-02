import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test} from 'node:test';\n${code}`;
const code = withImport('test("x", () => {});');

test.snapshot({
	valid: [
		// Not a test file — not checked even with a non-matching name
		{code: 'const a = 1;', filename: 'helpers.js'},

		// Matching the default pattern
		{code, filename: 'foo.test.js'},
		{code, filename: '/project/src/foo.test.js'},
		{code, filename: 'foo.test.ts'},
		{code, filename: 'foo.test.mjs'},

		// Custom pattern
		{code, filename: 'foo-test.js', options: [{pattern: String.raw`-test\.js$`}]},
	],
	invalid: [
		// Missing `.test.` segment
		{code, filename: 'foo.js'},
		{code, filename: '/project/src/foo.js'},

		// `-test` does not match the default pattern
		{code, filename: 'foo-test.js'},

		// Spec-style name does not match the default pattern
		{code, filename: 'foo.spec.js'},

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

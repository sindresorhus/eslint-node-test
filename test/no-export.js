import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file — exports are fine
		'export const helper = () => {};',
		'module.exports = {helper};',

		// Test file with no exports
		withImport('test("x", () => {});'),

		// Imports are allowed
		withImport('import assert from \'node:assert\';\ntest("x", () => {});'),

		// Local assignment that is not an export
		withImport('let value;\nvalue = 1;\ntest("x", () => {});'),

		// Assigning to a property that is not `exports`
		withImport('globalThis.foo = 1;\ntest("x", () => {});'),

		// `export {}` exports nothing — only marks the file as a module
		withImport('export {};\ntest("x", () => {});'),
	],
	invalid: [
		// Named export
		withImport('export const helper = () => {};\ntest("x", () => {});'),

		// Default export
		withImport('test("x", () => {});\nexport default {};'),

		// Re-export
		withImport('export * from \'./helpers.js\';\ntest("x", () => {});'),

		// Export specifier list
		withImport('const helper = () => {};\nexport {helper};\ntest("x", () => {});'),

		// TypeScript
		{
			code: withImport('export type Foo = string;\ntest("x", () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

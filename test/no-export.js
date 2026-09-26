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
		'import * as nodeTest from \'node:test\';\nexport {};\nnodeTest.test("x", () => {});',
	],
	invalid: [
		// Named export
		withImport('export const helper = () => {};\ntest("x", () => {});'),

		// A named re-export has a source and specifiers, so it is not the empty `export {}` marker
		withImport('const helper = () => {};\nexport {helper} from \'./helpers.js\';\ntest("x", () => {});'),
		withImport('export * as helpers from \'./helpers.js\';\ntest("x", () => {});'),

		// Default export of a declaration, not an expression
		withImport('export default function helper() {}\ntest("x", () => {});'),

		// A namespace import still makes it a test file
		'import * as nodeTest from \'node:test\';\nexport const helper = 1;\nnodeTest.test("x", () => {});',

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

		// TypeScript's own export forms are exports too
		{
			code: withImport('const helper = 1;\nexport = helper;\ntest("x", () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('declare namespace N {}\nexport as namespace N;\ntest("x", () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			// An `export` inside an ambient `declare module` block is a type-only surface, but the
			// parser reports it as an export declaration, so the rule sees it
			code: withImport('declare module "x" { export const a: number; }\ntest("x", () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

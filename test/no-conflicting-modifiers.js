import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, describe, it} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'test.skip.only("x", () => {});',

		// A single modifier (chained)
		withImport('test.skip("x", () => {});'),
		withImport('test.only("x", () => {});'),

		// A single modifier (options)
		withImport('test("x", {skip: true}, () => {});'),

		// Same modifier twice is redundant, not conflicting
		withImport('test.skip("x", {skip: true}, () => {});'),
		withImport('test.skip.skip("x", () => {});'),

		// Explicitly inactive modifier does not conflict
		withImport('test("x", {skip: false, only: true}, () => {});'),

		// No modifiers
		withImport('test("x", () => {});'),
	],
	invalid: [
		// Chained conflict
		withImport('test.skip.only("x", () => {});'),
		withImport('it.only.skip("x", () => {});'),

		// Options conflict
		withImport('test("x", {skip: true, only: true}, () => {});'),

		// A skip *reason* string still counts as an active skip, so it conflicts
		withImport('test("x", {skip: "later", only: true}, () => {});'),

		// Mixed chained + options conflict
		withImport('test.skip("x", {only: true}, () => {});'),

		// Three modifiers
		withImport('test("x", {only: true, skip: true, todo: true}, () => {});'),

		// `describe`
		withImport('describe.skip.only("s", () => {});'),

		// Hook with conflicting options
		'import {beforeEach} from \'node:test\';\nbeforeEach({skip: true, todo: true}, () => {});',

		// String-literal option key
		withImport('test("x", {"skip": true, only: true}, () => {});'),

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test.skip.only("x", () => {});',

		// TypeScript
		{
			code: withImport('test.skip.only("x", (): void => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, beforeEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'test("x", {skp: true}, () => {});',

		// Known test options
		withImport('test("x", {only: true}, () => {});'),
		withImport('test("x", {skip: true}, () => {});'),
		withImport('test("x", {todo: "later"}, () => {});'),
		withImport('test("x", {timeout: 1000}, () => {});'),
		withImport('test("x", {concurrency: true}, () => {});'),
		withImport('test("x", {signal: ac.signal}, () => {});'),
		withImport('test("x", {plan: 2}, () => {});'),
		withImport('test("x", {expectFailure: true}, () => {});'),
		withImport('test("x", {tags: ["slow"]}, () => {});'),

		// Known hook options
		withImport('beforeEach({timeout: 1000}, () => {});'),

		// No options object
		withImport('test("x", () => {});'),

		// Computed and spread keys cannot be checked statically
		withImport('test("x", {[key]: true}, () => {});'),
		withImport('test("x", {...options}, () => {});'),
	],
	invalid: [
		// Typo
		withImport('test("x", {skp: true}, () => {});'),

		// Unknown option
		withImport('test("x", {retry: 3}, () => {});'),

		// String-literal key
		withImport('test("x", {"skp": true}, () => {});'),

		// Multiple unknown keys
		withImport('test("x", {foo: 1, bar: 2}, () => {});'),

		// `only` is a test option but not a hook option
		withImport('beforeEach({only: true}, () => {});'),

		// `describe`
		'import {describe} from \'node:test\';\ndescribe("s", {foo: 1}, () => {});',

		// `suite` alias — shares `describe`'s option set
		'import {suite} from \'node:test\';\nsuite("s", {foo: 1}, () => {});',

		// TypeScript
		{
			code: withImport('test("x", {retry: 3}, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

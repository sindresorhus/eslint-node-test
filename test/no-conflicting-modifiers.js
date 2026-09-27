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

		// Expected failures can run as `only` tests or suites.
		withImport('test("x", {expectFailure: true, only: true}, () => {});'),
		withImport('test.expectFailure("x", {only: true}, () => {});'),
		withImport('describe("x", {expectFailure: true, only: true}, () => {});'),

		// Same modifier twice is redundant, not conflicting
		withImport('test.skip("x", {skip: true}, () => {});'),
		withImport('test.skip.skip("x", () => {});'),

		// Explicitly inactive modifier does not conflict
		withImport('test("x", {skip: false, only: true}, () => {});'),
		withImport('test("x", {skip: undefined, only: true}, () => {});'),
		{
			code: withImport('test("x", {skip: false as boolean, only: true}, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},

		// No modifiers
		withImport('test("x", () => {});'),
		// A hook's options carry no modifier, so an inert `skip`/`todo`/`only` there is an unknown
		// key for `no-unknown-test-options`, not a conflicting or disallowed modifier
		'import {beforeEach} from \'node:test\';\nbeforeEach({skip: true, todo: true}, () => {});',
		// `expectFailure` composes with `only`: the runner applies both, so a test that is both
		// exclusive-only and expected to fail means what it says
		withImport('test("x", {only: true, expectFailure: true}, () => {});'),
		withImport('test({name: "x", skip: true, fn() {}});'),
		// A subtest composes `expectFailure` with `only` the same way
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'c\', {expectFailure: true, only: true}, () => {}); });',
		// `only` composes with `todo` too: the test runs only under `--test-only` and still carries
		// the TODO marker
		withImport('test("x", {only: true, todo: true}, () => {});'),
		withImport('test.todo.only("x", () => {});'),
		'import {describe} from \'node:test\';\ndescribe("x", {only: true, todo: true}, () => {});',
	],
	invalid: [
		// Chained conflict
		withImport('test.skip.only("x", () => {});'),
		withImport('it.only.skip("x", () => {});'),

		// Options conflict
		withImport('test("x", {skip: true, only: true}, () => {});'),
		'import {expectFailure} from \'node:test\';\nexpectFailure("x", {skip: true}, () => {});',
		withImport('test("x", {expectFailure: true, skip: true}, () => {});'),

		// A skip *reason* string still counts as an active skip, so it conflicts
		withImport('test("x", {skip: "later", only: true}, () => {});'),

		// Mixed chained + options conflict
		withImport('test.skip("x", {only: true}, () => {});'),

		// Three modifiers
		withImport('test("x", {only: true, skip: true, todo: true}, () => {});'),

		// `describe`
		withImport('describe.skip.only("s", () => {});'),

		// The object descriptor form carries the same options
		withImport('test({name: "x", skip: true, only: true, fn() {}});'),

		// Hook with conflicting options

		// String-literal option key
		withImport('test("x", {"skip": true, only: true}, () => {});'),

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test.skip.only("x", () => {});',

		// TypeScript
		{
			code: withImport('test.skip.only("x", (): void => {});'),
			languageOptions: {parser: parsers.typescript},
		},

		// A subtest carries the same modifier options as an imported test
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'c\', {skip: true, only: true}, () => {}); });',

		// `todo` wins over `expectFailure`, which is then dropped rather than applied, so the
		// expected failure the author wrote never happens
		withImport('test("x", {todo: true, expectFailure: true}, () => {});'),
		withImport('test.expectFailure("x", {todo: true}, () => {});'),
		'import {it} from \'node:test\';\nit.todo("x", {expectFailure: "why"}, () => {});',
		'import {describe} from \'node:test\';\ndescribe("x", {todo: true, expectFailure: "why"}, () => {});',

		// `expectFailure` and `skip` are enabled by any value that is neither `undefined` nor `false`
		'import {test} from \'node:test\';\ntest(\'a\', {expectFailure: 0, skip: true}, () => {});',
		'import {test} from \'node:test\';\ntest(\'a\', {skip: 0, only: true}, () => {});',
		// `skip` is enabled by every value that is neither `undefined` nor `false`, `null` included
		'import {test} from \'node:test\';\ntest(\'a\', {skip: null, only: true}, () => {});',
		'import {test} from \'node:test\';\ntest(\'a\', {skip: \'\', only: true}, () => {});',
		'// A subtest registered from a hook callback is a real test\nimport {test, before} from \'node:test\';\nbefore(t => {\n	t.test(\'c\', {skip: true, only: true}, () => {});\n});',
	],
});

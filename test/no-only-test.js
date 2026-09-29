import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// A file may bind the module more than once, and the order of those imports must not matter: the namespace binding used to be a single slot that the last import overwrote.
		'import * as nt from "node:test";\nimport test from "node:test";\nnt.test("a", () => {});',
		'import test from "node:test";\nimport * as nt from "node:test";\nnt.describe("a", () => {});',
		// Not a test file
		'foo.only("title", () => {});',
		'test.only("title", () => {});',
		// Other modifiers
		'import test from "node:test";\ntest.skip("title", () => {});',
		'import {it} from "node:test";\nit("title", () => {});',
		// A trailing object is not the options slot: `node:test` reads options before the callback and ignores a trailing object, so the test is not actually modified. A trailing object after the callback is ignored by the runner, so it is not the options slot
		'import test from "node:test";\ntest("title", () => {}, {only: true});',
		'import {describe} from "node:test";\ndescribe("suite", () => {}, {only: true});',
		'import test from "node:test";\ntest({name: "a", fn() {}}, {only: true});',
		// A spread after the property makes the options unknowable
		'import test from "node:test";\ntest("title", {only: false, ...rest}, () => {});',
		// The last value wins
		'import test from "node:test";\ntest("title", {only: true, only: false}, () => {});',
		'import test from "node:test";\ntest.describe("suite", () => {}, {only: true});',
		'import test from "node:test";\ntest("title", {skip: true}, () => {});',
		'import test from "node:test";\ntest("title", {only: false}, () => {});',
		'import test from "node:test";\ntest("title", {only: undefined}, () => {});',
		{
			code: 'import test from "node:test";\ntest("title", {only: false as boolean}, () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		// `only` on an unrelated object
		'import test from "node:test";\nfoo.only();',
		// `expectFailure` does not have test modifiers.
		'import {expectFailure} from "node:test";\nexpectFailure.only("title", () => {});',
		'import test from "node:test";\ntest.expectFailure.only("title", () => {});',
		// A bare `test` package is not Node's test runner.
		'import test from "test";\ntest.only("title", () => {});',

		// `void 0` is `undefined`, so node:test does not treat it as only
		'import test from \'node:test\';\ntest(\'a\', {only: void 0}, () => {});',

		// `only` is a plain truthiness check, so a falsy value leaves it off
		'import test from \'node:test\';\ntest(\'a\', {only: 0}, () => {});',
		'import test from \'node:test\';\ntest(\'a\', {only: \'\'}, () => {});',
		// A hook's options carry no modifier, so an inert `skip`/`todo`/`only` there is an unknown key for `no-unknown-test-options`, not a conflicting or disallowed modifier
		'import {beforeEach} from "node:test";\nbeforeEach(() => {}, {only: true});',
		// A hook's options carry no modifier: `TestHook` reads only `hookType`, `loc`, `parent`, `timeout` and `signal`, so an inert `{only: true}` there is an unknown key for `no-unknown-test-options` rather than a disallowed modifier
		'import {beforeEach} from "node:test";\nbeforeEach({only: true}, () => {});',
	],
	invalid: [
		// Options in the slot the runner actually reads
		'import test from "node:test";\ntest("title", {only: true});',
		'import test from "node:test";\ntest({name: "a", only: true, fn() {}});',
		'import test from "node:test";\ntest("title", {fn() {}, only: true});',
		'import test from "node:test";\ntest("title", {only: true}, () => {}, 1);',
		'import test from "node:test";\ntest("title", {...rest, only: true}, () => {});',
		// The namespace binding works whichever import comes first
		'import * as nt from "node:test";\nimport test from "node:test";\nnt.only("a", () => {});',
		'import test from "node:test";\nimport * as nt from "node:test";\nnt.only("a", () => {});',

		'import test from "node:test";\ntest.only("title", () => {});',
		'import {it} from "node:test";\nit.only("title", () => {});',
		'import {describe} from "node:test";\ndescribe.only("title", () => {});',
		'import {test} from "node:test";\ntest.only("title", () => {});',
		'import {only} from "node:test";\nonly("title", () => {});',
		'import {only as focused} from "node:test";\nfocused("title", () => {});',
		'import test from "node:test";\ntest. /* keep */ only("title", () => {});',
		// Options object form
		'import test from "node:test";\ntest("title", {only: true}, () => {});',
		'import {it} from "node:test";\nit("title", {only: true}, () => {});',
		// Renamed import
		'import {test as t} from "node:test";\nt.only("title", () => {});',
		// Namespace import
		'import * as nodeTest from "node:test";\nnodeTest.test.only("title", () => {});',
		'import * as nodeTest from "node:test";\nnodeTest.only("title", () => {});',

		// A subtest carries the same modifier options as an imported test
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'c\', {only: true}, () => {}); });',
		// A TypeScript wrapper on the callee keeps the suggestion
		{
			code: 'import test from \'node:test\';\n(test.only as any)(\'a\', () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from \'node:test\';\ntest.only!(\'a\', () => {});',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

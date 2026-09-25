import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		'test.skip("title", () => {});',
		'import test from "node:test";\ntest("title", () => {});',
		// A trailing object is not the options slot: `node:test` reads options before the
		// callback and ignores a trailing object, so the test is not actually modified.
		'import test from "node:test";\ntest("title", () => {}, {skip: true});',
		'import test from "node:test";\ntest("title", {skip: false}, () => {});',
		// Only `false` and `undefined` leave the option off.
		'import test from "node:test";\ntest("title", {skip: undefined}, () => {});',
		{
			code: 'import test from "node:test";\ntest("title", {skip: false as boolean}, () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		'import test from "node:test";\nfoo.skip();',
		// `expectFailure` does not have test modifiers.
		'import {expectFailure} from "node:test";\nexpectFailure.skip("title", () => {});',
		'import test from "node:test";\ntest.expectFailure.skip("title", () => {});',

		// `void 0` is `undefined`, so node:test does not skip
		'import test from \'node:test\';\ntest(\'a\', {skip: void 0}, () => {});',
		// A value that resolves to `false` leaves the option off, however it is spelled
		'import test from \'node:test\';\ntest("title", {skip: (true, false)}, () => {});',

		// A trailing object is only options when nothing before it is the callback. The runner reads
		// options from the argument before the callback, so an object past it is never read.
		'import test from \'node:test\';\ntest(\'title\', fn, {skip: true});',
		'import test from \'node:test\';\ntest(\'title\', obj.method, {skip: true});',
		'import test from \'node:test\';\ntest(\'title\', \'x\', {skip: true});',
		'import test from \'node:test\';\ntest(\'title\', {}, {skip: true});',

		// A hook's options carry no modifier: `TestHook` reads only `hookType`, `loc`, `parent`,
		// `timeout` and `signal`, so an inert `{skip: true}` there is an unknown key for
		// `no-unknown-test-options` rather than a skipped test
		'import {beforeEach} from \'node:test\';\nbeforeEach(() => {}, {skip: true});',

		// A getter's value is what it returns, which cannot be read statically, so the option is left
		// alone: a getter that returns `false` does not skip the test
		'import test from \'node:test\';\ntest(\'title\', {get skip() { return false; }}, () => {});',
		'import test from \'node:test\';\ntest(\'title\', {get skip() { return true; }}, () => {});',
	],
	invalid: [
		'import test from "node:test";\ntest.skip("title", () => {});',
		'import {it} from "node:test";\nit.skip("title", () => {});',
		'import {describe} from "node:test";\ndescribe.skip("title", () => {});',
		'import {skip} from "node:test";\nskip("title", () => {});',
		'import {skip as omitted} from "node:test";\nomitted("title", () => {});',
		'import test from "node:test";\ntest("title", {skip: true}, () => {});',
		'import test from "node:test";\ntest("title", {skip: "not ready"}, () => {});',
		'import * as nodeTest from "node:test";\nnodeTest.test.skip("title", () => {});',
		'import * as nodeTest from "node:test";\nnodeTest.skip("title", () => {});',

		// A subtest carries the same modifier options as an imported test
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'c\', {skip: true}, () => {}); });',

		// `node:test` skips for any value that is neither `undefined` nor `false`
		'import test from \'node:test\';\ntest("title", {skip: 0}, () => {});',
		'import test from \'node:test\';\ntest("title", {skip: ""}, () => {});',
		'import test from \'node:test\';\ntest("title", {skip: null}, () => {});',
		'import test from \'node:test\';\ntest("title", {skip: Number.NaN}, () => {});',
	],
});

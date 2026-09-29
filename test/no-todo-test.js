import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		'test.todo("title");',
		'import test from "node:test";\ntest("title", () => {});',
		// A trailing object is not the options slot: `node:test` reads options before the callback and ignores a trailing object, so the test is not actually modified.
		'import test from "node:test";\ntest("title", () => {}, {todo: "wip"});',
		'import test from "node:test";\ntest("title", {todo: false}, () => {});',
		// Only `false` and `undefined` leave the option off.
		'import test from "node:test";\ntest("title", {todo: undefined}, () => {});',
		{
			code: 'import test from "node:test";\ntest("title", {todo: false as boolean}, () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		// Not a `node:test` binding.
		'import test from "node:test";\nfoo.todo();',
		// `expectFailure` does not have test modifiers.
		'import {expectFailure} from "node:test";\nexpectFailure.todo("title");',
		'import test from "node:test";\ntest.expectFailure.todo("title");',

		// `void 0` is `undefined`, so node:test does not mark it todo
		'import test from \'node:test\';\ntest(\'a\', {todo: void 0}, () => {});',
		// A value that resolves to `false` leaves the option off, however it is spelled
		'import test from \'node:test\';\ntest("title", {todo: (true, false)}, () => {});',
	],
	invalid: [
		'import test from "node:test";\ntest.todo("title");',
		'import {it} from "node:test";\nit.todo("title");',
		'import {describe} from "node:test";\ndescribe.todo("title", () => {});',
		'import {todo} from "node:test";\ntodo("title", () => {});',
		'import {todo as pending} from "node:test";\npending("title", () => {});',
		'import test from "node:test";\ntest("title", {todo: true}, () => {});',
		'import test from "node:test";\ntest("title", {todo: "later"}, () => {});',
		'import * as nodeTest from "node:test";\nnodeTest.test.todo("title", () => {});',
		'import * as nodeTest from "node:test";\nnodeTest.todo("title", () => {});',

		// A subtest carries the same modifier options as an imported test
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'c\', {todo: true}, () => {}); });',

		// `node:test` marks a todo for any value that is neither `undefined` nor `false`
		'import test from \'node:test\';\ntest("title", {todo: 0}, () => {});',
		'import test from \'node:test\';\ntest("title", {todo: ""}, () => {});',
		'import test from \'node:test\';\ntest("title", {todo: null}, () => {});',
		// A TypeScript wrapper on the callee keeps the suggestion
		{
			code: 'import test from \'node:test\';\n(test.todo as any)(\'a\', () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from \'node:test\';\ntest.todo!(\'a\', () => {});',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

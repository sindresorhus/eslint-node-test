import {getTester} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		'test.todo("title");',
		'import test from "node:test";\ntest("title", () => {});',
		'import test from "node:test";\ntest("title", {todo: false}, () => {});',
		// `node:test` treats the option as falsy, so the test is not actually a todo.
		'import test from "node:test";\ntest("title", {todo: 0}, () => {});',
		// Not a `node:test` binding.
		'import test from "node:test";\nfoo.todo();',
	],
	invalid: [
		'import test from "node:test";\ntest.todo("title");',
		'import {it} from "node:test";\nit.todo("title");',
		'import {describe} from "node:test";\ndescribe.todo("title", () => {});',
		'import test from "node:test";\ntest("title", {todo: true}, () => {});',
		'import test from "node:test";\ntest("title", {todo: "later"}, () => {});',
		'import * as nodeTest from "node:test";\nnodeTest.test.todo("title", () => {});',
	],
});

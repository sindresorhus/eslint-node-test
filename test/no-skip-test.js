import {getTester} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		'test.skip("title", () => {});',
		'import test from "node:test";\ntest("title", () => {});',
		'import test from "node:test";\ntest("title", {skip: false}, () => {});',
		// `node:test` treats the option as falsy, so the test is not actually skipped.
		'import test from "node:test";\ntest("title", {skip: ""}, () => {});',
		'import test from "node:test";\ntest("title", {skip: 0}, () => {});',
		'import test from "node:test";\ntest("title", {skip: undefined}, () => {});',
		'import test from "node:test";\nfoo.skip();',
	],
	invalid: [
		'import test from "node:test";\ntest.skip("title", () => {});',
		'import {it} from "node:test";\nit.skip("title", () => {});',
		'import {describe} from "node:test";\ndescribe.skip("title", () => {});',
		'import test from "node:test";\ntest("title", {skip: true}, () => {});',
		'import test from "node:test";\ntest("title", {skip: "not ready"}, () => {});',
		'import * as nodeTest from "node:test";\nnodeTest.test.skip("title", () => {});',
	],
});

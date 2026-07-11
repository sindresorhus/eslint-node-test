import {getTester, parsers} from './utils/test.js';

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
		{
			code: 'import test from "node:test";\ntest("title", {skip: false as boolean}, () => {});',
			languageOptions: {parser: parsers.typescript},
		},
		'import test from "node:test";\nfoo.skip();',
		// `expectFailure` does not have test modifiers.
		'import {expectFailure} from "node:test";\nexpectFailure.skip("title", () => {});',
		'import test from "node:test";\ntest.expectFailure.skip("title", () => {});',
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
	],
});

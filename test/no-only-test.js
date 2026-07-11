import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// Not a test file
		'foo.only("title", () => {});',
		'test.only("title", () => {});',
		// Other modifiers
		'import test from "node:test";\ntest.skip("title", () => {});',
		'import {it} from "node:test";\nit("title", () => {});',
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
	],
	invalid: [
		'import test from "node:test";\ntest.only("title", () => {});',
		'import {it} from "node:test";\nit.only("title", () => {});',
		'import {describe} from "node:test";\ndescribe.only("title", () => {});',
		'import {test} from "node:test";\ntest.only("title", () => {});',
		'import test from "node:test";\ntest. /* keep */ only("title", () => {});',
		// Options object form
		'import test from "node:test";\ntest("title", {only: true}, () => {});',
		'import {it} from "node:test";\nit("title", {only: true}, () => {});',
		// Renamed import
		'import {test as t} from "node:test";\nt.only("title", () => {});',
		// Namespace import
		'import * as nodeTest from "node:test";\nnodeTest.test.only("title", () => {});',
		// Bare "test" module
		'import test from "test";\ntest.only("title", () => {});',
	],
});

import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {Linter} from 'eslint';
import {getTester, parsers} from './utils/test.js';

const {ruleId, rule, test} = getTester(import.meta);

test.snapshot({
	valid: [
		// Not a test file — rule should not trigger
		'test("Test something", () => {});',
		// No format option — rule is effectively off
		'import test from "node:test";\ntest("Test something", () => {});',
		// The format is compiled with the `v` flag, so a `-` in a class has to be escaped
		{
			code: 'import test from "node:test";\ntest("(paren) title", () => {});',
			options: [{format: String.raw`^\(paren\) title$`}],
		},
		{
			code: 'import test from "node:test";\ntest("-dash title", () => {});',
			options: [{format: String.raw`^[\-a-z ]+$`}],
		},
		// A Unicode property escape works
		{
			code: 'import test from "node:test";\ntest("Ünicode title", () => {});',
			options: [{format: String.raw`^\p{Lu}[\p{Ll} ]+$`}],
		},
		// A `v` flag set operation works: an intersection and a difference
		{
			code: 'import test from "node:test";\ntest("Ünicode title", () => {});',
			options: [{format: String.raw`^[\p{L}&&\p{Lu}]`}],
		},
		{
			code: 'import test from "node:test";\ntest("Ünicode title", () => {});',
			options: [{format: String.raw`^[\p{L}--[a-z]]`}],
		},
		// Matches the pattern
		{
			code: 'import test from "node:test";\ntest("Should do something", () => {});',
			options: [{format: '^Should'}],
		},
		// Template literal that matches
		{
			code: 'import test from "node:test";\ntest(`Should do something`, () => {});',
			options: [{format: '^Should'}],
		},
		// Dynamic template literal — can't check statically, skip
		{
			// eslint-disable-next-line no-template-curly-in-string
			code: 'import test from "node:test";\ntest(`${prefix} do something`, () => {});',
			options: [{format: '^Should'}],
		},
		// No title — skip (test-title handles that)
		{
			code: 'import test from "node:test";\ntest(() => {});',
			options: [{format: '^Should'}],
		},
		// Hooks do not require a format match
		{
			code: 'import {before} from "node:test";\nbefore(() => {});',
			options: [{format: '^Should'}],
		},
		// Named import `it`
		{
			code: 'import {it} from "node:test";\nit("Should work", () => {});',
			options: [{format: '^Should'}],
		},
		// Renamed import that matches
		{
			code: 'import {test as t} from "node:test";\nt("Should work", () => {});',
			options: [{format: '^Should'}],
		},
		// Namespace import that matches
		{
			code: 'import * as nodeTest from "node:test";\nnodeTest.test("Should work", () => {});',
			options: [{format: '^Should'}],
		},
	],
	invalid: [
		// Does not match
		{
			code: 'import test from "node:test";\ntest("Test something", () => {});',
			options: [{format: '^Should'}],
		},
		// Template literal does not match
		{
			code: 'import test from "node:test";\ntest(`Test something`, () => {});',
			options: [{format: '^Should'}],
		},
		// `describe` / suite
		{
			code: 'import {describe} from "node:test";\ndescribe("My suite", () => {});',
			options: [{format: '^Should'}],
		},
		// `it` does not match
		{
			code: 'import {it} from "node:test";\nit("Test something", () => {});',
			options: [{format: '^Should'}],
		},
		// Renamed import
		{
			code: 'import {test as myTest} from "node:test";\nmyTest("Test something", () => {});',
			options: [{format: '^Should'}],
		},
		// Namespace import
		{
			code: 'import * as nodeTest from "node:test";\nnodeTest.test("Test something", () => {});',
			options: [{format: '^Should'}],
		},
		// TypeScript
		{
			code: 'import test from "node:test";\ntest("Test something", () => {});',
			options: [{format: '^Should'}],
			languageOptions: {parser: parsers.typescript},
		},
		// A subtest title is formatted the same way
		{
			code: 'import test from \'node:test\';\ntest(\'p\', async t => { await t.test(\'nope\', () => {}); });',
			options: [{format: '^Should'}],
		},
		// A `v` flag set operation is read as one: a lowercase first letter is outside both the intersection and the difference
		{
			code: 'import test from "node:test";\ntest("ünicode title", () => {});',
			options: [{format: String.raw`^[\p{L}&&\p{Lu}]`}],
		},
		{
			code: 'import test from "node:test";\ntest("unicode title", () => {});',
			options: [{format: String.raw`^[\p{L}--[a-z]]`}],
		},
	],
});

nodeTest('a format the `v` flag rejects is an invalid option', () => {
	// An unescaped `-` in a class and an identity escape such as `\ ` are valid without a flag, but not with `v`
	for (const format of ['^[-a-z ]+$', String.raw`^It\ .*_helper$`]) {
		assert.throws(
			() => {
				new Linter().verify('import test from "node:test";\ntest("x", () => {});', {
					plugins: {'rule-to-test': {rules: {[ruleId]: rule}}},
					rules: {[`rule-to-test/${ruleId}`]: ['error', {format}]},
				});
			},
			{message: /Invalid `format` option for `test-title-format`/},
		);
	}
});

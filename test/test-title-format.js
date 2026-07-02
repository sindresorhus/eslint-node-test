import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// Not a test file — rule should not trigger
		'test("Test something", () => {});',
		// No format option — rule is effectively off
		'import test from "node:test";\ntest("Test something", () => {});',
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
	],
});

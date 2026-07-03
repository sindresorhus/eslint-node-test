import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'test("x", t => { t.plan(1); t.plan(2); });',

		// Single plan
		withImport('test("x", t => { t.plan(1); });'),

		// Falsy plan options do not set a plan
		withImport('test("zero", {plan: 0}, t => { t.plan(1); });'),
		withImport('test("false", {plan: false}, t => { t.plan(1); });'),
		withImport('test("null", {plan: null}, t => { t.plan(1); });'),
		withImport('test("undefined", {plan: undefined}, t => { t.plan(1); });'),

		// Dynamic and invalid plan options are not treated as an existing plan
		withImport('function helper(plan) { test("x", {plan}, t => { t.plan(1); }); }'),
		withImport('test("true", {plan: true}, t => { t.plan(1); });'),
		withImport('test("string", {plan: "1"}, t => { t.plan(1); });'),
		withImport('test("negative", {plan: -1}, t => { t.plan(1); });'),
		withImport('test("float", {plan: 1.5}, t => { t.plan(1); });'),

		// Skipped test callbacks do not run
		withImport('test.skip("x", t => { t.plan(1); t.plan(2); });'),
		withImport('test("x", {skip: true}, t => { t.plan(1); t.plan(2); });'),
		withImport('test("x", {skip: "reason"}, t => { t.plan(1); t.plan(2); });'),
		withImport('test("parent", t => { t.test.skip("child", child => { child.plan(1); child.plan(2); }); });'),
		withImport('test("parent", t => { t.test("child", {skip: true}, child => { child.plan(1); child.plan(2); }); });'),
		withImport('test("parent", {plan: 1}, t => { t.test.skip("child", () => { t.plan(1); }); });'),

		// Separate tests each get their own plan
		withImport('test("a", t => { t.plan(1); });\ntest("b", t => { t.plan(1); });'),

		// Parent and child tests each get their own plan
		withImport('test("parent", t => { t.plan(1); t.test("child", child => { child.plan(1); }); });'),

		// Renamed context parameter
		withImport('test("x", context => { context.plan(1); });'),

		// Same context name shadowed by a nested subtest
		withImport('test("parent", t => { t.plan(1); t.test("child", t => { t.plan(1); }); });'),

		// Same context name shadowed by a regular helper parameter
		withImport('test("x", t => { t.plan(1); function helper(t) { t.plan(2); } });'),

		// No context parameter
		withImport('test("x", () => { t.plan(1); t.plan(2); });'),

		// Same context name shadowed by a regular helper parameter with a fake subtest method
		withImport('test("x", t => { function helper(t) { t.test("child", child => { child.plan(1); child.plan(2); }); } });'),

		// A `plan()` call in the title/options arguments is outside the test context parameter's scope
		withImport('const t = {plan() {}};\ntest(t.plan(1), t => { t.plan(1); });'),
		withImport('const t = {plan() { return false; }};\ntest("x", {skip: t.plan(1)}, t => { t.plan(1); });'),

		// Shadowed imported test binding
		withImport('function helper(test) { test("x", t => { t.plan(1); t.plan(2); }); }'),

		// Unknown chained members are not test modifiers
		withImport('test.unknown("x", t => { t.plan(1); t.plan(2); });'),
		'import * as nodeTest from \'node:test\';\nnodeTest.test.unknown("x", t => { t.plan(1); t.plan(2); });',

		// Unsupported computed, destructured, aliased, optional receiver, and optional call forms
		withImport('test("x", t => { t.plan(1); t["plan"](2); });'),
		withImport('test("x", t => { t.plan(1); const {plan} = t; plan(2); });'),
		withImport('test("x", t => { t.plan(1); const plan = t.plan; plan(2); });'),
		withImport('test("x", t => { t.plan(1); t?.plan(2); });'),
		withImport('test("x", t => { t.plan(1); t.plan?.(2); });'),

		// TypeScript
		{
			code: withImport('test("x", (t: any) => { t.plan(1); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Duplicate in one test
		withImport('test("x", t => { t.plan(1); t.plan(2); });'),

		// Three plans report the second and third
		withImport('test("x", t => { t.plan(1); t.plan(2); t.plan(3); });'),

		// Modifier chain
		withImport('test.only("x", t => { t.plan(1); t.plan(2); });'),

		// Test callbacks marked as incomplete do run
		withImport('test.todo("x", t => { t.plan(1); t.plan(2); });'),
		withImport('test("x", {todo: true}, t => { t.plan(1); t.plan(2); });'),
		withImport('test("x", {todo: "reason"}, t => { t.plan(1); t.plan(2); });'),
		withImport('test("parent", t => { t.test.todo("child", child => { child.plan(1); child.plan(2); }); });'),
		withImport('test("parent", t => { t.test("child", {todo: true}, child => { child.plan(1); child.plan(2); }); });'),

		// Options argument
		withImport('test("x", {skip: false}, t => { t.plan(1); t.plan(2); });'),
		withImport('function helper(shouldSkip) { test("x", {skip: shouldSkip}, t => { t.plan(1); t.plan(2); }); }'),

		// Plan option plus context plan
		withImport('test("x", {plan: 1}, t => { t.plan(1); });'),
		withImport('test({plan: 1}, t => { t.plan(1); });'),

		// Duplicate inside a subtest with a plan option
		withImport('test("parent", t => { t.test("child", {plan: 1}, child => { child.plan(1); }); });'),

		// Renamed context parameter
		withImport('test("x", context => { context.plan(1); context.plan(2); });'),

		// `it` alias
		'import {it} from \'node:test\';\nit("x", t => { t.plan(1); t.plan(2); });',

		// Named import
		'import {test} from \'node:test\';\ntest("x", t => { t.plan(1); t.plan(2); });',

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test("x", t => { t.plan(1); t.plan(2); });',

		// Namespace import with modifier chain
		'import * as nodeTest from \'node:test\';\nnodeTest.test.only("x", t => { t.plan(1); t.plan(2); });',

		// Duplicate inside a subtest
		withImport('test("parent", t => { t.test("child", child => { child.plan(1); child.plan(2); }); });'),

		// Duplicate inside a subtest with a modifier chain
		withImport('test("parent", t => { t.test.only("child", child => { child.plan(1); child.plan(2); }); });'),

		// Duplicate outer-context plan from inside a nested subtest
		withImport('test("parent", t => { t.plan(1); t.test("child", child => { t.plan(2); }); });'),

		// TypeScript
		{
			code: withImport('test("x", (t: any) => { t.plan(1); t.plan(2); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('(test as any)("x", (t: any) => { t.plan(1); t.plan(2); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript wrappers around the context receiver
		{
			code: withImport('test("x", (t: any) => { (t as any).plan(1); (t as any).plan(2); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('test("x", (t: any) => { t!.plan(1); t!.plan(2); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('test("x", (t: any) => { (t satisfies any).plan(1); (t satisfies any).plan(2); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('test("x", (t: any) => { (<any>t).plan(1); (<any>t).plan(2); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('test("parent", (t: any) => { (t as any).test("child", child => { child.plan(1); child.plan(2); }); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

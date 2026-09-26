import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import {test, beforeEach} from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not a test file
		'test("x", {skp: true}, () => {});',

		// The object form passes one descriptor object; `name` and `fn` are known there
		withImport('test({name: "x", fn() {}});'),
		withImport('test({name: "x", skip: true, timeout: 1, fn() {}});'),
		withImport('describe({name: "x", concurrency: 1, fn() {}});'),

		// `node:test` reads `fn` from the options slot too, so it is a known key there as well
		withImport('test("x", {fn() {}});'),
		withImport('test("x", {fn(t) { t.assert.ok(1); }});'),

		// Known test options
		// A trailing object after the callback is not the options slot, so its keys are not options
		withImport('test("x", () => {}, {notAnOption: 1});'),
		withImport('test("x", {only: true}, () => {});'),
		withImport('test("x", {skip: true}, () => {});'),
		withImport('test("x", {todo: "later"}, () => {});'),
		withImport('test("x", {timeout: 1000}, () => {});'),
		withImport('test("x", {concurrency: true}, () => {});'),
		withImport('test("x", {signal: ac.signal}, () => {});'),
		withImport('test("x", {plan: 2}, () => {});'),
		withImport('test("x", {expectFailure: true}, () => {});'),
		withImport('test("x", {tags: ["slow"]}, () => {});'),

		// Known hook options
		withImport('beforeEach({timeout: 1000}, () => {});'),

		// No options object
		withImport('test("x", () => {});'),

		// Computed and spread keys cannot be checked statically
		withImport('test("x", {[key]: true}, () => {});'),
		withImport('test("x", {...options}, () => {});'),

		// A key that cannot be an option name: a number is not a string, so there is no name to check
		withImport('test("x", {0: true}, () => {});'),
		// A shorthand property is matched on its name, like any other key
		withImport('test("x", {skip}, () => {});'),

		// Every key `node:test` recognizes for a test, in one object
		withImport('test("x", {concurrency: 1, expectFailure: true, fn() {}, name: "y", only: true, plan: 1, signal, skip: true, tags: [], timeout: 1, todo: true}, () => {});'),

		// Every key a hook recognizes, and nothing else
		withImport('beforeEach(() => {}, {signal, timeout: 1000});'),

		// A leading object is the descriptor whenever it appears, and `node:test` names a test after
		// `options.name` even outside the object form, so `name` is a known key in every slot
		withImport('test({name: "x", skip: true}, () => {});'),
		withImport('test({name: "x", skip: true}, {only: true});'),
		withImport('test("x", {name: "y"}, () => {});'),
		withImport('test("x", {name: "y"});'),
		withImport('test(function body() {}, {name: "y"});'),
	],
	invalid: [
		// A hook has no descriptor form, so `before({name})` is a hook with an options object
		// whose keys the runner ignores
		'import {before} from \'node:test\';\nbefore({name: "x"});',
		'import {afterEach} from \'node:test\';\nafterEach({name: "x"});',
		// A typo inside the object form is still unknown
		withImport('test({name: "x", skp: true, fn() {}});'),

		// Typo
		withImport('test("x", {skp: true}, () => {});'),

		// Unknown option
		withImport('test("x", {retry: 3}, () => {});'),

		// String-literal key
		withImport('test("x", {"skp": true}, () => {});'),

		// Multiple unknown keys
		withImport('test("x", {foo: 1, bar: 2}, () => {});'),

		// `only` is a test option but not a hook option
		withImport('beforeEach({only: true}, () => {});'),

		// Renamed import — the option set still applies
		'import {test as myTest} from \'node:test\';\nmyTest("x", {skp: true}, () => {});',

		// Default import
		'import test from \'node:test\';\ntest("x", {skp: true}, () => {});',

		// Namespace import
		'import * as nodeTest from \'node:test\';\nnodeTest.test("x", {skp: true}, () => {});',

		// A shorthand typo is still a typo
		withImport('test("x", {skp}, () => {});'),

		// A spread cannot be inspected, but a visible unknown key next to it is still reported
		withImport('test("x", {skp: true, ...rest}, () => {});'),

		// A hook reached through the default import reads the same options slot
		'import test from \'node:test\';\ntest.beforeEach(() => {}, {skp: 1});',

		// `describe`
		'import {describe} from \'node:test\';\ndescribe("s", {foo: 1}, () => {});',

		// `suite` alias — shares `describe`'s option set
		'import {suite} from \'node:test\';\nsuite("s", {foo: 1}, () => {});',

		// TypeScript
		{
			code: withImport('test("x", {retry: 3}, () => {});'),
			languageOptions: {parser: parsers.typescript},
		},

		// A hook has no title, so `name` is unknown in its trailing options too
		withImport('beforeEach(() => {}, {name: "x"});'),
		// A leading descriptor is still checked, with or without trailing arguments
		withImport('test({name: "x", skp: true}, () => {});'),
		withImport('test({name: "x", skp: true}, {skip: true});'),
		// A subtest and a context hook read their options the same way
		'import {test} from \'node:test\';\ntest(\'p\', async t => { await t.test(\'a\', {skp: true}, () => {}); });',
		'import {test} from \'node:test\';\ntest(\'p\', t => { t.beforeEach(() => {}, {skp: true}); });',

		// A hook takes its callback in the first position; the runner never reads `options.fn`
		'import {beforeEach} from \'node:test\';\nbeforeEach(() => {}, {fn: x});',
		'import {test} from \'node:test\';\ntest(\'o\', t => { t.beforeEach(() => {}, {fn: x}); });',

		// A hook declared through `getTestContext()` is the same hook
		'import {test, getTestContext} from \'node:test\';\ntest(\'o\', t => { getTestContext().beforeEach(() => {}, {bogus: 1}); });',
	],
});

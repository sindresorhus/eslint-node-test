import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Concurrency on a test that has subtests — meaningful
		withTest('test(\'t\', {concurrency: true}, async t => { await t.test(\'a\', () => {}); await t.test(\'b\', () => {}); });'),

		// Concurrency on a suite — governs the suite's children
		'import {describe, it} from \'node:test\';\ndescribe(\'s\', {concurrency: true}, () => { it(\'a\', () => {}); it(\'b\', () => {}); });',

		// Leaf test without the concurrency option
		withTest('test(\'t\', () => {});'),
		withTest('test(\'t\', {timeout: 1000}, () => {});'),
		// `concurrency: false` is the option turned off, the default, so there is nothing to misuse
		withTest('test(\'t\', {concurrency: false}, () => {});'),
		withTest('test(\'t\', {concurrency: undefined}, () => {});'),
		// `node:test` keeps its default for `null` too, so the option is not set
		withTest('test(\'t\', {concurrency: null}, () => {});'),

		// Concurrency on a subtest that itself has subtests
		withTest('test(\'t\', async t => { await t.test(\'inner\', {concurrency: true}, async s => { await s.test(\'a\', () => {}); }); });'),

		// Subtests created in a loop
		withTest('test(\'t\', {concurrency: true}, async t => { for (const x of xs) { await t.test(x, () => {}); } });'),

		// Concurrency with a modifier-chained subtest (`t.test.skip`)
		withTest('test(\'t\', {concurrency: true}, async t => { await t.test.skip(\'a\', () => {}); await t.test(\'b\', () => {}); });'),

		// Not a test file
		'test(\'t\', {concurrency: true}, () => {});',

		// A subtest created through `getTestContext()` is the same subtest, and must not crash the rule
		'import {test, getTestContext} from \'node:test\';\ntest(\'t\', async t => { await getTestContext().test(\'a\', () => {}); });',
		'import {test, getTestContext} from \'node:test\';\ntest(\'t\', {concurrency: 2}, async t => { await getTestContext().test(\'a\', () => {}); });',

		// A helper declared inside the test callback still runs on the test's own context
		withTest('test(\'t\', {concurrency: true}, t => { function addSubtests() { t.test(\'a\', () => {}); } addSubtests(); });'),
		withTest('test(\'t\', {concurrency: true}, t => { [1].forEach(() => { t.test(\'a\', () => {}); }); });'),
		// A subtest on an unrelated context is not this test's subtest, so the option is still unused
		withTest('test(\'t\', {concurrency: true}, async (t) => { await t.test(\'a\', s => { s.test(\'b\', () => {}); }); });'),

		// The option is only read from an options object literal, so an options object in a variable is
		// out of reach
		withTest('const options = {concurrency: true};\ntest(\'t\', options, () => {});'),
		withTest('test(\'t\', {...options}, () => {});'),

		// A TypeScript `this` parameter is erased at compile time, so the subtest is still a subtest
		{
			code: withTest('test(\'a\', {concurrency: true}, (this: void, t) => { t.test(\'b\', () => {}); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// A body named out of line is read where it is declared, outside the test, so its subtests cannot be counted and the option is left alone
		withTest('async function body(t) { await t.test(\'a\', () => {}); await t.test(\'b\', () => {}); }\ntest(\'t\', {concurrency: true}, body);'),
		withTest('test(\'t\', {concurrency: true}, body);\nasync function body(t) { await t.test(\'a\', () => {}); }'),
		withTest('const body = async t => { await t.test(\'a\', () => {}); };\ntest({name: \'t\', concurrency: true, fn: body});'),
		withTest('const body = async t => { await t.test(\'a\', {concurrency: true}, body); };\ntest(\'t\', {concurrency: true}, body);'),
		withTest('const body = () => {};\ntest(\'t\', {concurrency: true}, body);'),
		// Only an inline callback is checked, so an imported, member or factory callback is left alone as well
		'import test from \'node:test\';\nimport {body} from \'./body.js\';\ntest(\'t\', {concurrency: true}, body);',
		withTest('test(\'t\', {concurrency: true}, helpers.body);'),
		withTest('test(\'t\', {concurrency: true}, makeBody());'),
		withTest('test({name: \'t\', concurrency: true, fn: helpers.body});'),
	],
	invalid: [
		// Concurrency on a leaf test
		withTest('test(\'t\', {concurrency: true}, () => {});'),

		// Numeric concurrency on a leaf test
		withTest('test(\'t\', {concurrency: 5}, () => {});'),
		withTest('test(\'t\', {concurrency: 0}, () => {});'),

		// A dynamic value has no effect on a leaf test either, whatever it turns out to be
		withTest('test(\'t\', {concurrency: n}, () => {});'),
		withTest('test(\'t\', {concurrency: process.env.LIMIT}, () => {});'),
		withTest('test(\'t\', {concurrency: getConcurrency()}, () => {});'),
		withTest('const limit = 4;\ntest(\'t\', {concurrency: limit}, () => {});'),

		// The object descriptor form carries the option too
		withTest('test({name: \'t\', concurrency: true, fn() {}});'),

		// `it` alias
		'import {it} from \'node:test\';\nit(\'t\', {concurrency: true}, () => {});',

		// Concurrency on a subtest with no sub-subtests
		withTest('test(\'t\', async t => { await t.test(\'inner\', {concurrency: true}, () => {}); });'),

		// A parent test whose only subtest misuses the option itself
		withTest('test(\'t\', {concurrency: true}, async t => { await t.test(\'a\', {concurrency: true}, () => {}); });'),

		// No callback at all
		withTest('test(\'t\', {concurrency: true});'),

		// Test with an assertion but no subtests
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'t\', {concurrency: true}, t => { t.assert.ok(1); });',

		// A test inside a suite is still a test
		'import {describe, test} from \'node:test\';\ndescribe(\'s\', () => { test(\'t\', {concurrency: true}, () => {}); });',

		// A TypeScript `this` parameter is erased at compile time, so `t` is the context and `t.todo`
		// renames this test rather than registering a subtest
		{
			code: withTest('test(\'a\', {concurrency: true}, (this: void, t) => { t.todo(\'b\'); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// Limitation: an imported `test()` in a test body runs as a subtest, which `concurrency` does
		// govern, but only a `t.test()` subtest is counted
		'import test from \'node:test\';\ntest(\'t\', {concurrency: true}, async () => { await test(\'a\', () => {}); });',
		// A subtest registered in a hook is a real test, and a leaf one
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.test(\'a\', {concurrency: true}, () => {}); });',
	],
});

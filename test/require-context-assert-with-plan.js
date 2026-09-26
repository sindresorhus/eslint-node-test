import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withTest = code => `import test from 'node:test';\nimport assert from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		'import test from "node:test";\nimport assert from "node:assert";\ntest("a", {plan: 1}, t => { t.assert.ok(true); });',
		// Nothing to suggest when the callback has no context parameter to convert to
		'import test from "node:test";\nimport assert from "node:assert";\ntest("a", {plan: 1}, () => { assert.ok(true); });',
		'import test from "node:test";\nimport assert from "node:assert";\ntest("a", {skip: true}, t => { assert.ok(true); });',

		// No plan — imported assert is fine
		withTest('test(\'t\', t => { assert.ok(1); });'),
		// A `plan` option that is not a usable count declares no plan. `plan: 0` runs the body and
		// passes, a negative or non-numeric count never completes, and a dynamic one cannot be read.
		withTest('test(\'t\', {plan: 0}, t => { assert.ok(1); });'),
		withTest('test(\'t\', {plan: -1}, t => { assert.ok(1); });'),
		withTest('test(\'t\', {plan: \'nope\'}, t => { assert.ok(1); });'),
		withTest('function run(plan) {\n\ttest(\'t\', {plan}, t => { assert.ok(1); });\n}'),

		// Plan with context assert — counts toward the plan
		withTest('test(\'t\', t => { t.plan(1); t.assert.ok(1); });'),
		withTest('test(\'t\', t => { t.plan(2); t.assert.strictEqual(1, 1); t.assert.ok(2); });'),

		// A `.assert.*` call on an unrelated object is not a `node:assert` assertion
		withTest('test(\'t\', t => { t.plan(1); db.assert.ok(1); });'),

		// A TypeScript-wrapped context assert still counts toward the plan
		{
			code: withTest('test(\'t\', t => { t.plan(1); (t.assert.ok as unknown)(1); });'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withTest('test(\'t\', t => { t.plan(1); t!.assert.ok(1); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// Plan satisfied by a subtest — no imported assert
		'import test from \'node:test\';\ntest(\'t\', async t => { t.plan(1); await t.test(\'s\', () => {}); });',

		// Imported assert lives in a different test that has no plan
		withTest('test(\'a\', t => { t.plan(1); t.assert.ok(1); });\ntest(\'b\', () => { assert.ok(2); });'),

		// Outer plan, inner subtest uses imported assert but has no plan of its own
		withTest('test(\'t\', async t => { t.plan(1); await t.test(\'s\', () => { assert.ok(1); }); });'),

		// Not a test file
		'assert.ok(1);',
		// `t.plan(0)` expects zero counted assertions, so `t.assert` would fail it, and `t.plan(-1)` throws
		withTest('test(\'a\', t => { t.plan(0); assert.ok(1); });'),
		withTest('test(\'a\', t => { t.plan(-1); assert.ok(1); });'),

		// A statically skipped test, subtest, or suite never runs its callback, so there is no plan
		// to mismatch and nothing to convert.
		withTest('test.skip(\'a\', t => { t.plan(1); assert.ok(1); });'),
		withTest('test(\'a\', {skip: true}, t => { t.plan(1); assert.ok(1); });'),
		withTest('test(\'a\', async t => { await t.test(\'b\', {skip: true}, s => { s.plan(1); assert.ok(1); }); });'),
		'import {describe} from \'node:test\';\ndescribe.skip(\'s\', () => { test(\'a\', t => { t.plan(1); assert.ok(1); }); });',

		// A plan set through `getTestContext()` needs no context parameter, and a non-count sets no plan
		withTest('test(\'a\', () => { getTestContext().plan(1); assert.ok(1); });'),
		withTest('test(\'a\', t => { getTestContext().plan(0); assert.ok(1); });'),
		// A plan option is a real plan, but a context assertion already counts toward it
		withTest('test(\'t\', {plan: 1}, t => { t.assert.ok(1); });'),
		// Without a context parameter there is nothing to convert to unless `getTestContext` is imported
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'a\', {plan: 1}, () => { assert.ok(1); });',

		// A non-simple `plan` member is not a plan call the rule can read
		withTest('test(\'t\', t => { t[\'plan\'](1); assert.ok(1); });'),
		// A plan on a context that is not the tracked one belongs to no open frame
		withTest('test(\'t\', t => { other.plan(1); assert.ok(1); });'),
		// A suite has no plan, so a `plan` option on one declares no expectation
		'import {describe} from \'node:test\';\nimport assert from \'node:assert\';\ndescribe(\'s\', {plan: 1}, () => { assert.ok(1); });',
		// `node:test` reads the options from one fixed slot, so a trailing object is never read
		withTest('test(\'t\', () => { assert.ok(1); }, {plan: 1});'),
	],
	invalid: [
		// Plan + imported namespace assert
		withTest('test(\'t\', t => { t.plan(1); assert.strictEqual(1, 1); });'),

		// Plan + bare assert call
		withTest('test(\'t\', t => { t.plan(1); assert(1); });'),

		// Plan + named import assertion
		'import test from \'node:test\';\nimport {strictEqual} from \'node:assert\';\ntest(\'t\', t => { t.plan(1); strictEqual(1, 1); });',

		// Multiple imported asserts — one report each
		withTest('test(\'t\', t => { t.plan(2); assert.ok(1); assert.ok(2); });'),

		// Plan declared after the assertion
		withTest('test(\'t\', t => { assert.ok(1); t.plan(1); });'),

		// Renamed context parameter
		withTest('test(\'t\', context => { context.plan(1); assert.ok(1); });'),

		// Mixed: context assert counts, imported assert is flagged
		withTest('test(\'t\', t => { t.plan(2); t.assert.ok(1); assert.ok(2); });'),

		// Subtest with its own plan and an imported assert inside it
		withTest('test(\'t\', async t => { await t.test(\'s\', s => { s.plan(1); assert.ok(1); }); });'),

		// A plan set through `getTestContext()` is the same plan, in either spelling
		'import {test, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'t\', t => { getTestContext().plan(1); assert.ok(1); });',
		'import {test, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'t\', () => { getTestContext().plan(1); assert.ok(1); });',

		// A `todo` test still runs its body, so an imported assert inside one does not count
		'import {todo, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\ntodo(\'a\', () => { getTestContext().plan(1); assert.ok(1); });',

		// A `plan` option is the same plan, and a test with no context parameter reaches its context
		// through `getTestContext()` just as a `plan()` call does
		'import {test, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'a\', {plan: 1}, () => { assert.ok(1); });',
		'import {test, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'a\', {plan: 1}, t => { assert.ok(1); });',
		'import {test, getTestContext as gtc} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'a\', {plan: 1}, () => { assert.ok(1); });',
		'import {test, getTestContext as gtc} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'a\', () => { gtc().plan(1); assert.ok(1); });',
		'import {test, getTestContext as gtc} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'a\', {plan: 2}, () => { assert.ok(1); assert.ok(2); });',
		'import {test, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'a\', t => { t.test(\'b\', {plan: 1}, () => { assert.ok(1); }); });',
		'import {test, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\ntest({name: \'a\', plan: 1}, () => { assert.ok(1); });',
		{
			code: 'import {test, getTestContext} from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'a\', {plan: 1}, () => { (assert as any).ok(1); });',
			languageOptions: {parser: parsers.typescript},
		},

		// A `plan` option is the same plan as `t.plan(n)`, so the imported assertions are the ones
		// that do not count toward it
		withTest('test(\'t\', {plan: 1}, t => { assert.ok(1); });'),

		// A defaulted context parameter is still the context the plan belongs to
		withTest('test(\'t\', (t = getContext()) => { t.plan(1); assert.ok(1); });'),
		// A count that cannot be read statically is still a plan
		withTest('function run(n) {\n\ttest(\'t\', t => { t.plan(n); assert.ok(1); });\n}'),
		// `.only` does not change what a plan counts
		withTest('test.only(\'t\', t => { t.plan(1); assert.ok(1); });'),

		// A plan reached through `test.getTestContext()` is named the way the rule spells it, even when
		// the file never imported the function itself
		withTest('test(\'t\', t => { test.getTestContext().plan(1); assert.ok(1); });'),

		// The other assert module specifiers are the same imported assertions
		'import test from \'node:test\';\nimport {strictEqual} from \'node:assert/strict\';\ntest(\'t\', t => { t.plan(1); strictEqual(1, 1); });',
		'import test from \'node:test\';\nimport assert from \'assert/strict\';\ntest(\'t\', t => { t.plan(1); assert.ok(1); });',

		// A TypeScript-wrapped plan receiver is still the plan of that test
		{
			code: withTest('test(\'t\', t => { (t as Context).plan(1); assert.ok(1); });'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

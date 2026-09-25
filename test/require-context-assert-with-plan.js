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
	],
});

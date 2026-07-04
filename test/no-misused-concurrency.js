import {getTester} from './utils/test.js';

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

		// Concurrency on a subtest that itself has subtests
		withTest('test(\'t\', async t => { await t.test(\'inner\', {concurrency: true}, async s => { await s.test(\'a\', () => {}); }); });'),

		// Subtests created in a loop
		withTest('test(\'t\', {concurrency: true}, async t => { for (const x of xs) { await t.test(x, () => {}); } });'),

		// Concurrency with a modifier-chained subtest (`t.test.skip`)
		withTest('test(\'t\', {concurrency: true}, async t => { await t.test.skip(\'a\', () => {}); await t.test(\'b\', () => {}); });'),

		// Not a test file
		'test(\'t\', {concurrency: true}, () => {});',
	],
	invalid: [
		// Concurrency on a leaf test
		withTest('test(\'t\', {concurrency: true}, () => {});'),

		// Numeric concurrency on a leaf test
		withTest('test(\'t\', {concurrency: 5}, () => {});'),

		// `it` alias
		'import {it} from \'node:test\';\nit(\'t\', {concurrency: true}, () => {});',

		// Concurrency on a subtest with no sub-subtests
		withTest('test(\'t\', async t => { await t.test(\'inner\', {concurrency: true}, () => {}); });'),

		// No callback at all
		withTest('test(\'t\', {concurrency: true});'),

		// Test with an assertion but no subtests
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'t\', {concurrency: true}, t => { t.assert.ok(1); });',

		// Best-effort limitation: subtests created via a helper are not detected, so this is still reported
		withTest('function addSubtests(t) { t.test(\'a\', () => {}); }\ntest(\'t\', {concurrency: true}, async t => { addSubtests(t); });'),
	],
});

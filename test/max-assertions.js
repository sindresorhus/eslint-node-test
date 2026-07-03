import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const head = 'import test from \'node:test\';\nimport assert from \'node:assert\';\n';

const asserts = count => Array.from({length: count}, () => 'assert.ok(x);').join(' ');

test.snapshot({
	valid: [
		// Not a test file
		'assert.ok(a); assert.ok(b); assert.ok(c); assert.ok(d); assert.ok(e); assert.ok(f);',

		// At the default limit of 5
		`${head}test('x', () => { ${asserts(5)} });`,

		// Over the default limit, but allowed by a higher `max`
		{code: `${head}test('x', () => { ${asserts(6)} });`, options: [{max: 10}]},

		// Assertions split across separate tests — each counted on its own
		`${head}test('a', () => { ${asserts(3)} });\ntest('b', () => { ${asserts(3)} });`,

		// Subtests counted independently from the parent
		`${head}test('x', t => { ${asserts(3)} t.test('y', () => { ${asserts(3)} }); });`,

		// Assertions in a `describe` body but outside any `test` are not counted
		`import {describe, test} from 'node:test';\nimport assert from 'node:assert';\ndescribe('s', () => { ${asserts(6)} test('x', () => {}); });`,

		// Shadowed test binding
		`${head}function helper(test) { test('x', () => { ${asserts(6)} }); }`,
	],
	invalid: [
		// One past the default limit
		`${head}test('x', () => { ${asserts(6)} });`,

		// `t.assert.*` assertions are counted too
		`${head}test('x', t => { t.assert.ok(a); t.assert.ok(b); t.assert.ok(c); t.assert.ok(d); t.assert.ok(e); t.assert.ok(f); });`,

		// `t.assert.*` is counted even without a `node:assert` import (it is the context's own assert)
		'import test from \'node:test\';\ntest(\'x\', t => { t.assert.ok(a); t.assert.ok(b); t.assert.ok(c); t.assert.ok(d); t.assert.ok(e); t.assert.ok(f); });',

		// Custom lower limit
		{code: `${head}test('x', () => { ${asserts(3)} });`, options: [{max: 2}]},

		// A subtest over the limit while the parent is under it
		{code: `${head}test('x', t => { assert.ok(a); t.test('y', () => { ${asserts(3)} }); });`, options: [{max: 2}]},

		// `it` alias
		`import {it} from 'node:test';\nimport assert from 'node:assert';\nit('x', () => { ${asserts(6)} });`,

		// TypeScript
		{
			code: `${head}test('x', () => { ${asserts(6)} });`,
			languageOptions: {parser: parsers.typescript},
		},
	],
});

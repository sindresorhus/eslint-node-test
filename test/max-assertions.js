import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const head = 'import test from \'node:test\';\nimport assert from \'node:assert\';\n';

const asserts = (count, receiver = 'assert') => Array.from({length: count}, () => `${receiver}.ok(x);`).join(' ');

test.snapshot({
	valid: [
		// Not a test file
		'assert.ok(a); assert.ok(b); assert.ok(c); assert.ok(d); assert.ok(e); assert.ok(f);',

		// At the default limit of 5
		`${head}test('x', () => { ${asserts(5)} });`,

		// Over the default limit, but allowed by a higher `max`
		{code: `${head}test('x', () => { ${asserts(6)} });`, options: [{max: 10}]},

		// A suite body is not a test body, and a helper the test body calls is a separate case
		`${head}function body() { ${asserts(6)} }\ndescribe('x', body);`,
		`${head}function helper() { ${asserts(6)} }\ntest('x', () => { helper(); });`,

		// Assertions split across separate tests — each counted on its own
		`${head}test('a', () => { ${asserts(3)} });\ntest('b', () => { ${asserts(3)} });`,

		// Subtests counted independently from the parent
		`${head}test('x', t => { ${asserts(3)} t.test('y', () => { ${asserts(3)} }); });`,

		// Assertions in a `describe` body but outside any `test` are not counted
		`import {describe, test} from 'node:test';\nimport assert from 'node:assert';\ndescribe('s', () => { ${asserts(6)} test('x', () => {}); });`,

		// Shadowed test binding
		`${head}function helper(test) { test('x', () => { ${asserts(6)} }); }`,

		// `.assert.*` on a non-context object is not counted
		`${head}const fixture = {assert: {ok: () => {}}};\ntest('t', () => { ${asserts(6, 'fixture.assert')} });`,

		// A hook's own context is not the test's, so its assertions do not count toward the test
		`${head}test('t', t => { t.beforeEach(hook => { ${asserts(6, 'hook.assert')} }); });`,
		`${head}test('t', t => { t.beforeEach(({assert: check}) => { ${asserts(6, 'check')} }); });`,
	],
	invalid: [
		// One past the default limit
		`${head}test('x', () => { ${asserts(6)} });`,

		// A test body the call names out of line is counted the same way
		`${head}function body() { ${asserts(6)} }\ntest('x', body);`,
		`${head}const body = () => { ${asserts(6)} };\ntest('x', body);`,
		`${head}function body() { ${asserts(6)} }\ntest('x', {fn: body});`,

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

		// The context of a test body the call names out of line, by name and destructured
		`import {test} from 'node:test';\nfunction body(t) { ${asserts(6, 't.assert')} }\ntest('x', body);`,
		`import {test} from 'node:test';\nconst body = ({assert: check}) => { ${asserts(6, 'check')} };\ntest('x', body);`,
		// A subtest body named out of line and registered through `getTestContext()`
		{
			code: 'import {test, getTestContext} from \'node:test\';\ntest(\'a\', () => { getTestContext().test(\'b\', body); });\nfunction body(t) { t.assert.ok(1); t.assert.ok(2); }',
			options: [{max: 1}],
		},
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withNamespaceAssert = code => `import * as assert from 'node:assert';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;
const withNamedStrictImport = (methods, code) => `import {${methods}} from 'node:assert/strict';\n${code}`;
const withTest = code => `import test from 'node:test';\n${code}`;
const withNamespaceTest = code => `import * as nodeTest from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import, ignored
		'assert.throws(() => { setup(); run(); });',

		// Only the test context `t.assert` is matched, not unrelated `assert` properties
		withAssert('custom.assert.throws(() => { setup(); run(); });'),
		withTest('test(\'t\', t => { custom.assert.throws(() => { setup(); run(); }); });'),
		withTest('test(\'t\', t => { { const t = custom; t.assert.throws(() => { setup(); run(); }); } });'),
		withTest('test(\'outer\', t => { { const t = custom; t.test(\'fake\', u => { u.assert.throws(() => { setup(); run(); }); }); } });'),
		withAssert('function helper(assert) { assert.throws(() => { setup(); run(); }); }'),
		withAssert('function helper(assert) { assert.strict.throws(() => { setup(); run(); }); }'),
		withNamespaceAssert('function helper(assert) { assert.throws(() => { setup(); run(); }); }'),
		withNamedImport('throws', 'function helper(throws) { throws(() => { setup(); run(); }); }'),
		withNamedImport('strict as strictAssert', 'function helper(strictAssert) { strictAssert.throws(() => { setup(); run(); }); }'),
		withTest('function helper(test) { test(\'t\', t => { t.assert.throws(() => { setup(); run(); }); }); }'),
		withNamespaceTest('function helper(nodeTest) { nodeTest.test(\'t\', t => { t.assert.throws(() => { setup(); run(); }); }); }'),

		// Single callback action
		withAssert('assert.throws(() => run());'),
		withAssert('assert.throws(() => { run(); });'),
		withAssert('assert.rejects(async () => run());'),
		withAssert('assert.throws(function () { run(); });'),
		withAssert('assert.strict.throws(() => { run(); });'),
		withAssert('assert.throws(() => { return run(); });'),
		withAssert('assert.throws(() => { throw new Error("expected"); });'),

		// Non-inline callbacks are intentionally not chased
		withAssert('assert.throws(callback);'),

		// Spread arguments are not statically known
		withAssert('assert.throws(...args);'),

		// Computed assertion calls are intentionally not matched
		withAssert('assert[\'throws\'](() => { setup(); run(); });'),

		// Other assertions are unaffected
		withAssert('assert.doesNotThrow(() => { setup(); run(); });'),
		withAssert('assert.doesNotReject(async () => { setup(); await run(); });'),
		withAssert('assert.ok(() => { setup(); run(); });'),

		// TypeScript callback expression
		{
			code: withAssert('assert.throws((() => { run(); }) as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},

		// A TypeScript-wrapped non-context receiver is not a test context
		{
			code: withTest('test(\'t\', t => { (custom as any).assert.throws(() => { setup(); run(); }); });'),
			languageOptions: {parser: parsers.typescript},
		},

		// A same-named parameter outside the test callback is a different variable
		withTest('test(\'t\', t => {});\nfunction helper(t) { t.assert.throws(() => { setup(); run(); }); }'),

		// Suite contexts have no `assert`
		'import {describe} from \'node:test\';\ndescribe(\'s\', s => { s.assert.throws(() => { setup(); run(); }); });',
	],
	invalid: [
		withAssert('assert.throws(() => { setup(); run(); });'),
		'import assert from \'assert\';\nassert.throws(() => { setup(); run(); });',
		withAssert('assert.rejects(async () => { setup(); await run(); });'),
		withAssert('assert.throws(function () { setup(); run(); });'),
		withStrictAssert('assert.throws(() => { setup(); run(); });'),
		withNamespaceAssert('assert.throws(() => { setup(); run(); });'),
		withAssert('assert.strict.throws(() => { setup(); run(); });'),
		withNamespaceAssert('assert.strict.rejects(async () => { setup(); await run(); });'),
		withNamedImport('throws', 'throws(() => { setup(); run(); });'),
		withNamedImport('throws as assertThrows', 'assertThrows(() => { setup(); run(); });'),
		withNamedImport('rejects', 'rejects(async () => { setup(); await run(); });'),
		withNamedImport('strict as strictAssert', 'strictAssert.throws(() => { setup(); run(); });'),
		withNamedImport('strict as strictAssert', 'strictAssert.rejects(async () => { setup(); await run(); });'),
		'import {throws} from \'assert/strict\';\nthrows(() => { setup(); run(); });',
		withNamedStrictImport('throws', 'throws(() => { setup(); run(); });'),
		withAssert('assert?.throws(() => { setup(); run(); });'),
		withTest('test(\'t\', t => { t.assert.throws(() => { setup(); run(); }); });'),
		withTest('test(\'t\', (t = undefined) => { t.assert.throws(() => { setup(); run(); }); });'),
		withTest('test(\'t\', t => { t.assert.rejects(async () => { setup(); await run(); }); });'),
		withTest('test.only(\'t\', t => { t.assert.throws(() => { setup(); run(); }); });'),
		withNamespaceTest('nodeTest.test(\'t\', t => { t.assert.throws(() => { setup(); run(); }); });'),
		withNamespaceTest('nodeTest.test.only(\'t\', t => { t.assert.throws(() => { setup(); run(); }); });'),
		// Standalone modifier import — `only()` is a test, so its callback declares a context
		'import {only} from \'node:test\';\nonly(\'t\', t => { t.assert.throws(() => { setup(); run(); }); });',

		// Hook callbacks receive a test context too
		'import {beforeEach} from \'node:test\';\nbeforeEach(t => { t.assert.throws(() => { setup(); run(); }); });',

		// Including hooks declared from an enclosing test context
		withTest('test(\'t\', t => { t.beforeEach(u => { u.assert.throws(() => { setup(); run(); }); }); });'),

		withTest('test(\'outer\', t => { t.test(\'inner\', u => { u.assert.throws(() => { setup(); run(); }); }); });'),
		withTest('test(\'outer\', t => { t.test(\'inner\', u => { u.assert.rejects(async () => { setup(); await run(); }); }); });'),
		withAssert('assert.throws(() => { setup(); /* comment */ run(); });'),
		{
			code: withAssert('assert.throws((() => { setup(); run(); }) as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws((() => { setup(); run(); })!);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws((() => { setup(); run(); }) satisfies () => void);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.throws(<() => void>(() => { setup(); run(); }));'),
			languageOptions: {parser: parsers.typescript},
		},

		// A TypeScript-wrapped or optional-chained real context receiver still reports
		{
			code: withTest('test(\'t\', t => { (t as any).assert.throws(() => { setup(); run(); }); });'),
			languageOptions: {parser: parsers.typescript},
		},
		withTest('test(\'t\', t => { t?.assert.throws(() => { setup(); run(); }); });'),
	],
});

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
		withNamespaceAssert('function helper(assert) { assert.throws(() => { setup(); run(); }); }'),
		withNamedImport('throws', 'function helper(throws) { throws(() => { setup(); run(); }); }'),
		withTest('function helper(test) { test(\'t\', t => { t.assert.throws(() => { setup(); run(); }); }); }'),
		withNamespaceTest('function helper(nodeTest) { nodeTest.test(\'t\', t => { t.assert.throws(() => { setup(); run(); }); }); }'),

		// Single callback action
		withAssert('assert.throws(() => run());'),
		withAssert('assert.throws(() => { run(); });'),
		withAssert('assert.rejects(async () => run());'),
		withAssert('assert.throws(function () { run(); });'),
		withAssert('assert.throws(() => { return run(); });'),
		withAssert('assert.throws(() => { throw new Error("expected"); });'),

		// Non-inline callbacks are intentionally not chased
		withAssert('assert.throws(callback);'),

		// Spread arguments are not statically known
		withAssert('assert.throws(...args);'),

		// Other assertions are unaffected
		withAssert('assert.doesNotThrow(() => { setup(); run(); });'),
		withAssert('assert.doesNotReject(async () => { setup(); await run(); });'),
		withAssert('assert.ok(() => { setup(); run(); });'),

		// TypeScript callback expression
		{
			code: withAssert('assert.throws((() => { run(); }) as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		withAssert('assert.throws(() => { setup(); run(); });'),
		withAssert('assert.rejects(async () => { setup(); await run(); });'),
		withAssert('assert.throws(function () { setup(); run(); });'),
		withStrictAssert('assert.throws(() => { setup(); run(); });'),
		withNamespaceAssert('assert.throws(() => { setup(); run(); });'),
		withNamedImport('throws', 'throws(() => { setup(); run(); });'),
		withNamedImport('throws as assertThrows', 'assertThrows(() => { setup(); run(); });'),
		withNamedImport('rejects', 'rejects(async () => { setup(); await run(); });'),
		withNamedStrictImport('throws', 'throws(() => { setup(); run(); });'),
		withTest('test(\'t\', t => { t.assert.throws(() => { setup(); run(); }); });'),
		withNamespaceTest('nodeTest.test(\'t\', t => { t.assert.throws(() => { setup(); run(); }); });'),
		withTest('test(\'outer\', t => { t.test(\'inner\', u => { u.assert.throws(() => { setup(); run(); }); }); });'),
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
	],
});

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import
		'assert.doesNotThrow(fn);',

		// Useful assertions
		withAssert('assert.throws(fn);'),
		withAssert('assert.rejects(fn);'),
		withAssert('assert.ok(value);'),

		// `.assert.doesNotThrow` on a non-context object — not a test context
		'import test from \'node:test\';\ntest(\'t\', () => { const db = makeDb(); db.assert.doesNotThrow(() => foo()); });',
	],
	invalid: [
		// DoesNotThrow
		withAssert('assert.doesNotThrow(fn);'),
		withAssert('assert.doesNotThrow(() => compute());'),

		// DoesNotReject
		withAssert('await assert.doesNotReject(fn);'),

		// Named import
		withNamedImport('doesNotThrow', 'doesNotThrow(fn);'),

		// T.assert
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.doesNotThrow(fn); });',

		// TypeScript
		{
			code: withAssert('assert.doesNotThrow(fn as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

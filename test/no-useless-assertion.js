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

		// A method of the same name on an unrelated object, with a real `node:assert` import present
		'import assert from \'node:assert\';\nchai.assert.doesNotThrow(() => foo());',
	],
	invalid: [
		// DoesNotThrow
		withAssert('assert.doesNotThrow(fn);'),
		withAssert('assert.doesNotThrow(() => compute());'),

		// The message argument does not make the assertion useful
		withAssert('assert.doesNotThrow(fn, \'should not throw\');'),

		// DoesNotReject
		withAssert('await assert.doesNotReject(fn);'),

		// Named import
		withNamedImport('doesNotThrow', 'doesNotThrow(fn);'),
		withNamedImport('doesNotReject', 'doesNotReject(fn);'),

		// Namespace import
		'import * as assert from \'node:assert\';\nassert.doesNotThrow(fn);',

		// The strict view of the namespace
		'import {strict as assert} from \'node:assert\';\nassert.doesNotThrow(fn);',

		// Optional chaining does not make the call anything else
		withAssert('assert.doesNotThrow?.(fn);'),

		// T.assert
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.doesNotThrow(fn); });',
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.doesNotReject(fn); });',

		// TypeScript
		{
			code: withAssert('assert.doesNotThrow(fn as () => void);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			// A non-null assertion on the context receiver
			code: 'import test from \'node:test\';\ntest(\'t\', t => { t.assert!.doesNotThrow(fn); });',
			languageOptions: {parser: parsers.typescript},
		},
	],
});

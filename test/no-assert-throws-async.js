import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;
const inAsyncTest = code => `import test from 'node:test';\nimport assert from 'node:assert';\ntest('t', async () => {\n\t${code}\n});`;

test.snapshot({
	valid: [
		// Not an assert import, ignored
		'assert.throws(async () => {});',

		// Synchronous function, correct usage
		withAssert('assert.throws(() => {});'),
		withAssert('assert.throws(function () {});'),
		withAssert('assert.doesNotThrow(() => {});'),

		// Already using the async variant
		withAssert('await assert.rejects(async () => {});'),
		withAssert('await assert.doesNotReject(async () => {});'),

		// Async function correctly passed to `rejects`, not this rule's concern
		withAssert('await assert.rejects(async () => {}, /boom/);'),

		// First argument is not a function (a promise value)
		withAssert('await assert.rejects(promise, /boom/);'),

		// Non-async arrow returning a promise, intentionally not detected (kept simple)
		withAssert('assert.throws(() => doAsync());'),

		// Other methods
		withAssert('assert.ok(async () => {});'),

		// `.assert.throws` on a non-context object — not a test context
		withAssert('const custom = {assert: {throws() {}}};\ncustom.assert.throws(async () => {});'),
	],
	invalid: [
		// Async arrow passed to `throws`, bare statement in async function (await added)
		inAsyncTest('assert.throws(async () => {});'),

		// Async function expression
		inAsyncTest('assert.throws(async function () {});'),

		// With an error matcher second argument
		inAsyncTest('assert.throws(async () => {}, /boom/);'),

		// Strict namespace
		inAsyncTest('assert.strict.throws(async () => {});'),
		'import test from \'node:test\';\nimport {strict as strictAssert} from \'node:assert\';\ntest(\'t\', async () => {\n\tstrictAssert.throws(async () => {});\n});',

		// `doesNotThrow` -> `doesNotReject`
		inAsyncTest('assert.doesNotThrow(async () => {});'),

		// Already awaited, suggestion only renames
		inAsyncTest('await assert.throws(async () => {});'),

		// Bare statement outside an async function, suggestion renames without adding `await`
		withAssert('assert.throws(async () => {});'),

		// Return value used, suggestion renames only
		withAssert('const promise = assert.throws(async () => {});'),

		// T.assert form
		'import test from \'node:test\';\ntest(\'t\', async t => { t.assert.throws(async () => {}); });',

		// Named import, reported but not fixed
		withNamedImport('throws', 'throws(async () => {});'),

		// TypeScript, async arrow with a type annotation on the matcher
		{
			code: inAsyncTest('assert.throws(async (): Promise<void> => {}, TypeError);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

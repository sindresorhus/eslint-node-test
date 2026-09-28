# no-unawaited-promise-assertion

📝 Disallow assertions inside unawaited Promise callbacks.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Assertions inside a floating Promise callback are not connected to the Promise returned by the test callback. A failure can be swallowed by a downstream rejection handler or escape as unhandled asynchronous activity instead of failing the test. A floating `Promise.all([…])`, `allSettled`, `race`, or `any` is floating in the same way, so an assertion in a chain inside its array counts too. The combinator must be the floating expression itself: one with a `.then()`, `.catch()`, or `.finally()` chained on it (`Promise.all([…]).catch(…)`) is not looked into.

Return or await the Promise chain so `node:test` waits for the assertion.

This rule owns Promise-callback assertions. [`no-late-test-activity`](no-late-test-activity.md) reports other detached Promise activity and assertions in scheduler callbacks.

Only directly executed activity in the test or hook callback is checked, whether it is written inline or named out of line (`test('a', body)`). External callbacks and nested helper functions are not analyzed.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert';

// ❌
test('loads', () => {
	load().then(value => {
		assert.strictEqual(value, 42);
	});
});

// ✅
test('loads', async () => {
	const value = await load();
	assert.strictEqual(value, 42);
});

// ✅
test('loads', () => {
	return load().then(value => {
		assert.strictEqual(value, 42);
	});
});
```

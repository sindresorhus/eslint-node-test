# no-late-test-activity

📝 Disallow test activity inside detached asynchronous callbacks.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Detached `setTimeout()`, `setImmediate()`, `queueMicrotask()`, and floating Promise callbacks can run after a test or hook finishes. A floating `Promise.all([…])`, `allSettled`, `race`, or `any` counts too: nothing awaits it, so the chains inside its array are just as detached. This rule reports assertions in scheduler callbacks and throws or subtests in any supported callback. [`no-unawaited-promise-assertion`](no-unawaited-promise-assertion.md) reports assertions in floating Promise callbacks.

Return or await asynchronous work so the test runner waits for it. Consumed Promise chains and scheduler callbacks inside a consumed `new Promise()` are allowed. Throws are also allowed when a downstream rejection callback handles them. The rule skips callback-style tests and hooks, and tests with a statically recognizable `t.plan(..., {wait: <truthy>})` call as a top-level statement of the test body, anywhere before the first top-level `return` or `throw`.

The automatic `await` fix is only offered for a chain or a `Promise.all()` / `Promise.allSettled()` with direct chain elements. Awaiting `race()` or `any()` does not wait for every element, and combinators do not await chains inside nested arrays, so these cases need a manual fix.

Only directly executed activity in the test or hook callback is checked, whether it is written inline or named out of line (`test('a', body)`). External callbacks, nested helper functions, and nested detached callbacks are not analyzed. A chain in a `for` loop's initializer or update slot, or under `void` in a static field initializer, is not read as floating.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert/strict';

// ❌
test('loads', () => {
	setTimeout(() => {
		assert.ok(loaded);
	}, 10);
});

// ❌
test('loads', () => {
	load().then(() => {
		throw new Error('Failed to load');
	});
});

// ✅
test('loads', async () => {
	const value = await load();
	assert.equal(value, 42);
});

// ✅
test('loads', async () => {
	await new Promise(resolve => {
		setTimeout(() => {
			assert.ok(loaded);
			resolve();
		}, 10);
	});
});
```

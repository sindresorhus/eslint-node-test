# no-late-test-activity

📝 Disallow test activity inside detached asynchronous callbacks.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Detached `setTimeout()`, `setImmediate()`, `queueMicrotask()`, and floating Promise callbacks can run after a test or hook finishes. This rule reports assertions in scheduler callbacks and throws or subtests in any supported callback. [`no-unawaited-promise-assertion`](no-unawaited-promise-assertion.md) reports assertions in floating Promise callbacks.

Return or await asynchronous work so the test runner waits for it. Consumed Promise chains and scheduler callbacks inside a consumed `new Promise()` are allowed. Throws are also allowed when a downstream rejection callback handles them. The rule skips callback-style tests and hooks, and tests whose first relevant statement is a statically recognizable `t.plan(..., {wait: <truthy>})` call.

Only directly executed activity in inline callbacks is checked. External callbacks, nested helper functions, and nested detached callbacks are not analyzed.

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

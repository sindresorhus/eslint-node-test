# no-late-test-activity

📝 Disallow test activity inside detached asynchronous callbacks.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A test finishes when its callback returns or its returned Promise settles. Asynchronous activity started by the test can continue afterward, causing assertions, thrown errors, and subtests to be reported separately from the test that created them.

This rule reports test activity inside detached `setTimeout()`, `setImmediate()`, `queueMicrotask()`, and floating Promise callbacks. Return or await the asynchronous work so the test runner knows when the test is complete. Promise chains whose values are otherwise consumed are not checked.

Synchronous assertions and throws in a floating Promise callback are allowed when a downstream rejection callback handles them. Promise-returning assertions are still reported unless their Promise is handled directly.

Scheduler callbacks inside a consumed `new Promise()` are allowed. Tests that call `t.plan()` with a statically truthy `wait` option as the first statement other than variable declarations, function declarations, and empty statements are also allowed because the test runner explicitly waits for the planned activity.

Callback-style tests and hooks are not checked because their completion depends on when the completion callback is invoked.

Only directly executed activity in inline callbacks is checked. External callback references and nested helper function bodies are not analyzed.

Detached callbacks scheduled from inside another detached callback are not recursively analyzed.

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
	load().then(value => {
		assert.equal(value, 42);
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

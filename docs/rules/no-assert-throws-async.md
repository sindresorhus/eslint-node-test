# no-assert-throws-async

📝 Disallow passing an async function to `assert.throws()`/`assert.doesNotThrow()`.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.throws()` and `assert.doesNotThrow()` only catch errors thrown *synchronously*. An async function never throws synchronously: calling it returns a promise that rejects. So `assert.throws(async () => { … })` runs the function, gets back a (rejected) promise, sees no synchronous exception, and fails with a "missing expected exception" error regardless of what the function does. The asynchronous counterparts `assert.rejects()` and `assert.doesNotReject()` are the correct choice, and their result must be awaited (see [`no-unawaited-rejects`](./no-unawaited-rejects.md)).

This rule reports `assert.throws()` / `assert.doesNotThrow()` calls whose first argument is an async function expression. It offers a suggestion to switch to the async equivalent, adding `await` when the call is a bare statement inside an async function.

Only inline async function expressions are detected. A non-async function that returns a promise is not flagged, since that cannot be determined statically.

| Method | Replacement |
|---|---|
| `throws` | `rejects` |
| `doesNotThrow` | `doesNotReject` |

## Examples

```js
import test from 'node:test';
import assert from 'node:assert';

test('rejects', async () => {
	// ❌
	assert.throws(async () => {
		await failingOperation();
	}, /boom/);

	// ✅
	await assert.rejects(async () => {
		await failingOperation();
	}, /boom/);
});
```

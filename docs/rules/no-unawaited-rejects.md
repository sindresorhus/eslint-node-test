# no-unawaited-rejects

📝 Require `assert.rejects()`/`assert.doesNotReject()` to be awaited or returned.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.rejects()` and `assert.doesNotReject()` return a `Promise` that must be `await`ed or `return`ed. Calling them without `await` leaves the assertion unhandled. The test itself still reports as passing, but `node:test` notices the activity that ran after the test ended, reports the file as failed with a diagnostic naming the unhandled rejection, and exits non-zero: so the assertion still runs, just after the test it was meant to guard is over.

A call in an operand position whose value a statement throws away is just as unhandled, so a conditional, logical, or sequence expression that hands the `Promise` to such a statement is reported as well.

Discarding the `Promise` with `void` does not help — it still leaves the assertion unhandled — so it is reported too (without an autofix).

## Examples

```js
import assert from 'node:assert';

// ❌
async function bare() {
	assert.rejects(fn); // The assertion runs only after the test ends, as an unhandled rejection
}

// ❌
async function discarded() {
	void assert.rejects(fn); // `void` discards the Promise but leaves it unhandled
}

// ✅
async function awaited() {
	await assert.rejects(fn);
}

// ✅
async function returned() {
	return assert.rejects(fn);
}
```

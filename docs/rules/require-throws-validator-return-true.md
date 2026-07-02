# require-throws-validator-return-true

📝 Require validator functions in `assert.throws()`/`assert.rejects()` to return `true`.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.throws()` and `assert.rejects()` accept a validator function as the error matcher. Node expects that validator to return the boolean value `true` after its internal checks pass. If the validator returns `undefined`, a truthy non-boolean value, a `Promise`, or a generator object, Node throws an `AssertionError` even when the assertions inside the validator passed. This includes async and generator validator functions.

This rule reports inline validator functions passed to `assert.throws()`/`assert.rejects()` when they cannot return `true`. Referenced validators are ignored.

## Examples

```js
import assert from 'node:assert/strict';

// ❌
assert.throws(() => run(), error => {
	assert.match(error.message, /bad/);
});

// ✅
assert.throws(() => run(), error => {
	assert.match(error.message, /bad/);
	return true;
});
```

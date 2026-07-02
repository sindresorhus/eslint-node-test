# require-throws-expectation

📝 Require an error matcher for `assert.throws()`/`assert.rejects()`.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.throws(fn)` and `assert.rejects(asyncFn)` with no second argument pass for *any* thrown value. That makes the assertion weak: a typo, a `ReferenceError`, or an unrelated failure all satisfy it, so the test can pass for the wrong reason. Pass an error matcher — an error class, a `RegExp` for the message, a validation object, or a validation function — to assert that the *expected* error is thrown.

This rule reports a single-argument `assert.throws()`/`assert.rejects()`. A string second argument is reported by [`no-assert-throws-string`](no-assert-throws-string.md) instead.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.throws(() => parse(input));
await assert.rejects(() => load(url));

// ✅
assert.throws(() => parse(input), SyntaxError);
await assert.rejects(() => load(url), {code: 'ENOENT'});
```

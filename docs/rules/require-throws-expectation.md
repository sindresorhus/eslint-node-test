# require-throws-expectation

📝 Require an error matcher for `assert.throws()`/`assert.rejects()`.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.throws(fn)` and `assert.rejects(asyncFn)` with no second argument pass for *any* thrown value. So does an explicit `undefined` or `null` matcher, which `node:assert` reads the same way. That makes the assertion weak: a typo, a `ReferenceError`, or an unrelated failure all satisfy it, so the test can pass for the wrong reason. Pass an error matcher — an error class, a `RegExp` for the message, a validation object, or a validation function — to assert that the *expected* error is thrown.

This rule reports a matcher that is missing, `undefined`, or `null`, and one `node:assert` rejects: a primitive (a number, a boolean, a bigint) or an empty object or array. A primitive is rejected with `ERR_INVALID_ARG_TYPE`, but only after the function has run. An empty object or array is not rejected up front at all: it behaves like no matcher until an error is caught, and then throws `ERR_INVALID_ARG_VALUE`. A string second argument is the failure message, which [`no-assert-throws-string`](no-assert-throws-string.md) reports instead.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.throws(() => parse(input));
assert.throws(() => parse(input), undefined);
await assert.rejects(() => load(url));
await assert.rejects(() => load(url), null);

// ✅
assert.throws(() => parse(input), SyntaxError);
await assert.rejects(() => load(url), {code: 'ENOENT'});
```

# no-unneeded-async-rejects-callback

📝 Disallow unneeded async callbacks passed to `assert.rejects()`.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.rejects()` accepts either a Promise or a function that returns a Promise. Wrapping a single awaited operation in an `async` callback is often unnecessary and makes the assertion harder to read.

The suggestion replaces the wrapper with a plain Promise-returning callback. Keeping the callback, rather than passing an already-created Promise, preserves lazy invocation and argument evaluation order.

Apply the suggestion only when the operation returns a genuine Promise and cannot throw synchronously. For a synchronous throw, `assert.rejects()` skips the error matcher and returns a Promise rejected with the original error. For a return value that is not a genuine Promise, including a thenable, it rejects with `ERR_INVALID_RETURN_VALUE`, while an async wrapper converts the value into a Promise.

This rule reports parameterless async callbacks whose entire body is one awaited expression. Callbacks with parameters, additional statements, or control flow are ignored.

## Examples

```js
import assert from 'node:assert/strict';

// ❌
await assert.rejects(async () => await operation());

// ✅
await assert.rejects(() => operation());
```

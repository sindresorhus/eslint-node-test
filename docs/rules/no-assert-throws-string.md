# no-assert-throws-string

📝 Disallow a string as the error matcher of `assert.throws()`/`assert.rejects()`.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.throws(fn[, error][, message])` and `assert.rejects(asyncFn[, error][, message])` take an optional error matcher followed by an optional failure message. A string in the matcher position is interpreted as the **message**, not as something to validate the thrown error against. So `assert.throws(fn, 'Wrong value')` passes for *any* thrown error, and if the thrown error's message happens to equal the string, Node throws `ERR_AMBIGUOUS_ARGUMENT`. From the [Node.js docs](https://nodejs.org/api/assert.html#assertthrowsfn-error-message): "if a string is provided as the second argument, then `error` is assumed to be omitted... This can lead to easy-to-miss mistakes."

This rule reports a string (or template literal) passed as the second argument to `assert.throws()`/`assert.rejects()`. The suggestion rewrites it to a validation object that matches the error message.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.throws(fn, 'Wrong value');
assert.rejects(asyncFn, 'Wrong value');

// ✅
assert.throws(fn, {message: 'Wrong value'});
assert.throws(fn, /Wrong value/);
assert.throws(fn, TypeError);

// ✅ (a string in the third position is the failure message)
assert.throws(fn, TypeError, 'should have thrown a TypeError');
```

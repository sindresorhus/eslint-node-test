# no-assert-match-string

📝 Disallow strings as the regexp argument of `assert.match()`/`assert.doesNotMatch()`.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.match(value, regexp[, message])` and `assert.doesNotMatch(value, regexp[, message])` require a `RegExp` as the second argument. Passing a string throws `TypeError ERR_INVALID_ARG_TYPE` at runtime instead of checking the value.

This rule reports a string or template literal passed as the regexp argument. It can suggest wrapping the string in `new RegExp()` or, when the string is meant to be the exact expected value, changing the assertion to `assert.strictEqual()`/`assert.notStrictEqual()`. It is separate from [`prefer-assert-match`](prefer-assert-match.md), which rewrites other assertion styles to `assert.match()`.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.match(value, 'foo');
assert.doesNotMatch(value, 'foo');

// ✅
assert.match(value, /foo/);
assert.doesNotMatch(value, /foo/);
assert.match(value, new RegExp('foo'));
```

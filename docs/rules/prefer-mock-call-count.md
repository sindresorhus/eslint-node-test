# prefer-mock-call-count

📝 Prefer `mock.callCount()` over `mock.calls.length`.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`mock.calls` creates a copy of the mock's internal call history. [`mock.callCount()`](https://nodejs.org/api/test.html#ctxcallcount) returns the same count without allocating that copy.

This rule reports direct, non-computed `mock.calls.length` access in files that import `node:test` and replaces it with `mock.callCount()`. It does not handle optional or computed access, or TypeScript wrappers around `mock.calls`, and it does not cover property mocks, which use `accessCount()` instead.

## Examples

```js
import test from 'node:test';

const spy = test.mock.fn();

// ❌
assert.equal(spy.mock.calls.length, 1);

// ✅
assert.equal(spy.mock.callCount(), 1);
```

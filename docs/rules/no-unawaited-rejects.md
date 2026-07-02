# no-unawaited-rejects

📝 Require `assert.rejects()`/`assert.doesNotReject()` to be awaited or returned.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.rejects()` and `assert.doesNotReject()` return a `Promise` that must be `await`ed or `return`ed. Calling them without `await` means the assertion may never execute and the test can pass silently even if the code under test throws the wrong error or no error at all.

## Examples

```js
import assert from 'node:assert';

// ❌
async function test() {
	assert.rejects(fn); // Promise is unhandled — assertion never executes
}

// ✅
async function test() {
	await assert.rejects(fn);
}

// ✅
async function test() {
	return assert.rejects(fn);
}
```

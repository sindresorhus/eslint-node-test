# no-standalone-assert

📝 Disallow assertions outside of a test.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

An assertion written at the top level of a test file runs once when the module is loaded, not as part of any test. A failure there aborts the whole file before the tests run, and a passing one is never attributed to a test. It almost always means the assertion was meant to be inside a `test` or hook.

This rule reports `node:assert` assertions at the module top level of a file that imports `node:test`. Assertions inside a `describe`/`suite` body are handled by [`no-assert-in-describe`](./no-assert-in-describe.md), and assertions inside helper functions are allowed (a helper may be called from a test). Top-level assertions in modules that do not import `node:test` are left alone, since they are legitimate runtime guards.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert/strict';

// ❌
assert.ok(setupSucceeded);

// ✅
test('setup succeeds', () => {
	assert.ok(setupSucceeded);
});
```

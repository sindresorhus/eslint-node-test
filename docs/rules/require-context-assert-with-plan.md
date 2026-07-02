# require-context-assert-with-plan

📝 Require assertions to use the test context when the test sets a plan.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

The test context's `plan()` method declares how many assertions and subtests a test expects to run. Only assertions made through the test context (`t.assert.*`) and subtests are counted toward the plan. Assertions from the separately-imported `node:assert` module are invisible to the runner, so they do not count, and the test fails with a plan mismatch (`plan expected N assertions but received fewer`).

This rule reports imported `node:assert` assertions (namespace, named, or bare `assert()`) inside any test that calls `plan()`. Switch them to the test context's `t.assert` so they count. See also [`prefer-test-context-assert`](./prefer-test-context-assert.md), which can perform that conversion.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert';

test('plan', t => {
	t.plan(1);

	// ❌ — not counted, the test fails with a plan mismatch
	assert.strictEqual(actual, expected);

	// ✅ — counted toward the plan
	t.assert.strictEqual(actual, expected);
});
```

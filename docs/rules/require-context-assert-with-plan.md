# require-context-assert-with-plan

📝 Require assertions to use the test context when the test sets a plan.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

The test context's `plan()` method declares how many assertions and subtests a test expects to run. Only assertions made through the test context (`t.assert.*`) and subtests are counted toward the plan. Assertions from the separately-imported `node:assert` module are invisible to the runner, so they do not count, and the test fails with a plan mismatch (`plan expected 1 assertions but received 0`).

This rule reports imported `node:assert` assertions (namespace, named, or bare `assert()`) inside any test that calls `plan()` or sets the `plan` option, and inside a hook that calls `plan()`: a hook's context is the context of the test the hook runs for, and a plan set in one carries into that test. Switch them to the test context's `t.assert` so they count. A test with no context parameter can still reach its context through `getTestContext()`, so the rule names that call when the file imports it. See also [`prefer-test-context-assert`](./prefer-test-context-assert.md), which can perform that conversion.

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

```js
import {test, getTestContext} from 'node:test';
import assert from 'node:assert';

// ❌ — the `plan` option is a plan too, and the imported assert does not count
test('plan', {plan: 1}, () => {
	assert.strictEqual(actual, expected);
});

// ✅ — a test with no context parameter still has one, through `getTestContext()`
test('plan', {plan: 1}, () => {
	getTestContext().assert.strictEqual(actual, expected);
});
```

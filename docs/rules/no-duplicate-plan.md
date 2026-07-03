# no-duplicate-plan

📝 Disallow calling `t.plan()` more than once in the same test.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

The test context's `plan()` method sets the number of assertions and subtests expected to run in a test. Calling it more than once during the same test run fails at runtime with `cannot set plan more than once`, and usually means a previous refactor left a stale plan behind.

This rule reports the second and later direct `<context>.plan()` calls for the same test context. Plans in separate tests or subtests are independent and not reported. To keep the rule simple, it is path-insensitive and does not follow aliases, destructuring, computed properties, optional calls, or the test-level `plan` option.

## Examples

```js
import test from 'node:test';

// ❌
test('user', t => {
	t.plan(1);
	t.plan(2);
	t.assert.ok(user.active);
});

// ✅
test('user', t => {
	t.plan(1);
	t.assert.ok(user.active);
});

// ✅ (separate subtest plan)
test('user', t => {
	t.plan(1);
	t.test('permissions', t => {
		t.plan(1);
		t.assert.ok(user.admin);
	});
});
```

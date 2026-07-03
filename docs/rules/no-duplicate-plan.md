# no-duplicate-plan

📝 Disallow setting a test plan more than once in the same test.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Declare a plan only once per test. Both `t.plan()` and the test-level `plan` option set the expected assertion and subtest count, and setting it again fails at runtime.

Plans in separate tests and subtests are independent. Skipped callbacks are ignored; todo callbacks are checked. To stay simple, this rule is path-insensitive and ignores aliases, destructuring, computed properties, and optional calls.

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
```

```js
import test from 'node:test';

// ❌
test('user', {plan: 1}, t => {
	t.plan(1);
	t.assert.ok(user.active);
});

// ✅
test('user', t => {
	t.plan(1);
	t.test('permissions', t => {
		t.plan(1);
		t.assert.ok(user.admin);
	});
});
```

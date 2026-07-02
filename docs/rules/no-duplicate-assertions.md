# no-duplicate-assertions

📝 Disallow adjacent duplicate assertions.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Repeating the same assertion twice in a row is usually a copy-paste leftover. The second assertion does not verify anything new and can hide the assertion that was meant to be written.

This rule only reports adjacent identical assertion statements inside a test body. It intentionally does not report the same assertion repeated later in the test, since that can be a valid way to check that a value stayed stable across an operation.

Assertions are compared by their canonical assertion method and normalized argument source. For example, `assert(value)` and `assert.ok(value)` are treated as the same assertion.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert/strict';

// ❌
test('user', () => {
	assert.strictEqual(user.id, 1);
	assert.strictEqual(user.id, 1);
});

// ✅
test('user is stable after update', () => {
	assert.strictEqual(user.id, 1);
	update(user);
	assert.strictEqual(user.id, 1);
});
```

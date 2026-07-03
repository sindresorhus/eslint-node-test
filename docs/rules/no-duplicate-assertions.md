# no-duplicate-assertions

📝 Disallow adjacent duplicate assertions.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Repeating the same assertion twice in a row is usually a copy-paste leftover and does not verify anything new.

This rule only reports adjacent identical assertion statements inside a test body. Later repeats are allowed so tests can assert that a value stayed stable across an operation. Assertions are compared by canonical method and normalized argument source, so `assert(value)` and `assert.ok(value)` are equivalent.

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

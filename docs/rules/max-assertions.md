# max-assertions

📝 Enforce a maximum number of assertions in a test.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A test that makes many assertions is usually checking several things at once and is harder to read and debug when it fails. Splitting it into focused tests makes each failure point clear.

This rule reports a test whose body makes more than the allowed number of assertions. Assertions in a subtest (`t.test(…)`) are counted against that subtest, not its parent.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert/strict';

// ❌
test('user', () => {
	assert.strictEqual(user.name, 'Ada');
	assert.strictEqual(user.age, 36);
	assert.strictEqual(user.email, 'ada@example.com');
	assert.ok(user.active);
	assert.ok(user.admin);
	assert.ok(user.verified);
});

// ✅
test('user identity', () => {
	assert.strictEqual(user.name, 'Ada');
	assert.strictEqual(user.email, 'ada@example.com');
});

test('user permissions', () => {
	assert.ok(user.admin);
	assert.ok(user.verified);
});
```

## Options

### `max`

Type: `number`\
Default: `5`

The maximum number of assertions allowed in a test.

```js
/* eslint
	node-test/max-assertions: [
		'error',
		{
			max: 3
		}
	]
*/
import test from 'node:test';
import assert from 'node:assert/strict';

// ❌
test('user', () => {
	assert.strictEqual(user.name, 'Ada');
	assert.strictEqual(user.age, 36);
	assert.ok(user.active);
	assert.ok(user.admin);
});
```

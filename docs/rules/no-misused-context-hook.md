# no-misused-context-hook

📝 Disallow context hooks without runnable subtests.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`t.beforeEach()` and `t.afterEach()` run around the current test's subtests. On a test without runnable subtests, there is nothing for them to run around, so their callbacks do nothing. Put the setup or cleanup directly in the test, or create subtests.

This rule only detects direct inline `t.test()` calls. It does not trace helper calls, runtime conditions, or whether a hook was registered before a subtest ran.

> [!NOTE]
> `t.before()` and `t.after()` are not reported because they run for the current test, including a test without subtests.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert/strict';

// ❌
test('does work', t => {
	t.beforeEach(() => {
		prepare();
	});

	assert.equal(result, expected);
});

// ✅
test('group', async t => {
	t.beforeEach(() => {
		prepare();
	});

	await t.test('does work', () => {
		assert.equal(result, expected);
	});
});
```

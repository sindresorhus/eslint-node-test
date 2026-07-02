# no-async-fn-without-await

📝 Disallow async test/hook functions that have no `await` expression.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

An async test or hook callback that never uses `await` (or `for await`) is misleading and should be written without `async`. Declaring a function `async` without any actual suspension point adds unnecessary overhead and signals intent that is not there.

## Examples

```js
import test from 'node:test';

// ❌
test('foo', async t => {
	t.assert.strictEqual(1 + 1, 2);
});

// ✅
test('foo', t => {
	t.assert.strictEqual(1 + 1, 2);
});

// ✅
test('foo', async t => {
	const result = await someAsyncOperation();
	t.assert.strictEqual(result, 42);
});
```

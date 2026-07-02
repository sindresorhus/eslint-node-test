# prefer-async-await

📝 Prefer async/await over returning a Promise.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Returning a Promise chain from a test callback is harder to read and debug than using `async`/`await`. This rule flags non-async test callbacks that return a `.then()` chain or a variable that was assigned from one.

## Examples

```js
import test from 'node:test';

// ❌
test('foo', t => {
	return fetchData().then(data => {
		t.assert.strictEqual(data.length, 3);
	});
});

// ✅
test('foo', async t => {
	const data = await fetchData();
	t.assert.strictEqual(data.length, 3);
});
```

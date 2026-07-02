# prefer-assert-throws

📝 Prefer `assert.throws()`/`assert.rejects()` over try/catch with an assertion.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Using `assert.throws()` or `assert.rejects()` is cleaner and more expressive than wrapping throwing code in a try/catch with assertions in the catch block.

## Examples

```js
import assert from 'node:assert';

// ❌
try {
	throwingFn();
} catch (error) {
	assert.ok(error instanceof TypeError);
}

// ❌
try {
	await asyncFn();
} catch (error) {
	assert.ok(error instanceof TypeError);
}

// ✅
assert.throws(() => throwingFn(), TypeError);

// ✅
await assert.rejects(() => asyncFn(), TypeError);
```

# prefer-test-context-assert

📝 Prefer the test context `t.assert` over the imported `node:assert`.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

The test context exposes the `node:assert` methods as [`t.assert`](https://nodejs.org/api/test.html#contextassert). Using them instead of the imported `node:assert` ties each assertion to the running test, which lets the runner count assertions and makes [`t.plan()`](https://nodejs.org/api/test.html#contextplancount-options) work.

This rule reports imported `node:assert` calls made inside a test whose callback has a context parameter, including strict namespace forms, and suggests the `t.assert` equivalent. Calls outside a test, in a hook, or in a subtest whose callback takes no context parameter are left alone, since there is no context to convert to.

The suggestion preserves behavior: a loose method imported from `node:assert/strict` (for example `assert.equal`) is mapped to its strict counterpart (`t.assert.strictEqual`), because `t.assert` exposes the non-strict functions.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert/strict';

// ❌
test('title', t => {
	assert.equal(actual, expected);
});

// ✅
test('title', t => {
	t.assert.strictEqual(actual, expected);
});
```

# prefer-mock-method

📝 Prefer `mock.method()` over assigning `mock.fn()` to an object property.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Replacing an object's method by assigning a `mock.fn()` to it (`object.method = mock.fn()`) discards the original implementation and leaves no way for the runner to restore it. `mock.method(object, 'method')` records the original, tracks calls, and restores it automatically (when using the test context's `t.mock`) or via `mock.restoreAll()`.

This rule reports assignments of `mock.fn()` / `t.mock.fn()` to a member expression and suggests the equivalent `mock.method()` call. Any implementation passed to `mock.fn()` becomes the implementation argument of `mock.method()`. See also [`prefer-context-mock`](./prefer-context-mock.md), which prefers the auto-restoring `t.mock` over the global `mock`.

## Examples

```js
import test from 'node:test';

test('mock', t => {
	// ❌
	object.method = t.mock.fn(() => 'stub');

	// ✅
	t.mock.method(object, 'method', () => 'stub');
});
```

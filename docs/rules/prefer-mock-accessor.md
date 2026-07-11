# prefer-mock-accessor

📝 Prefer `mock.getter()` and `mock.setter()` over `mock.method()` with accessor options.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`mock.getter()` and `mock.setter()` are the dedicated forms of `mock.method()` for accessor properties. They make the kind of property being mocked clear at the call site.

This rule reports `mock.method()` and `t.mock.method()` calls whose statically analyzable options set exactly one accessor to `true`. Four-argument calls require an inline implementation to preserve overload resolution. It skips dynamic options and object getters, where the replacement could alter behavior. The autofix changes only `.method`; remove the redundant flag separately if desired.

See also [`prefer-context-mock`](./prefer-context-mock.md), which prefers the automatically restored test context tracker over the global `mock` tracker.

## Examples

```js
import test from 'node:test';

test('mocks an accessor', t => {
	// ❌
	t.mock.method(object, 'value', () => 'stub', {getter: true});

	// ✅
	t.mock.getter(object, 'value', () => 'stub');
});
```

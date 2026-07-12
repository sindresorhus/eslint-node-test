# no-duplicate-mock-timers-enable

📝 Disallow enabling mock timers more than once without resetting them.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`mock.timers.enable()` throws `ERR_INVALID_STATE` when mock timers are already enabled on that tracker. Call `mock.timers.reset()` or `mock.reset()` before enabling them again.

This rule follows direct `mock.timers` calls on imported global mocks, including suite callbacks, and inline test or hook context parameters. It is control-flow-aware, so a reset must execute on every path before another `enable()` is allowed. To stay simple, aliases, destructuring, computed or optional calls, helper functions, repeated loop iterations, and state shared across separate callbacks are ignored.

## Examples

```js
import {mock} from 'node:test';

// ❌
mock.timers.enable();
mock.timers.enable();

// ✅
mock.timers.enable();
mock.timers.reset();
mock.timers.enable();
```

```js
import test from 'node:test';

// ❌
test('uses mocked time', t => {
	t.mock.timers.enable();
	t.mock.timers.enable();
});

// ✅
test('uses mocked time', t => {
	t.mock.timers.enable();
	t.mock.reset();
	t.mock.timers.enable();
});
```

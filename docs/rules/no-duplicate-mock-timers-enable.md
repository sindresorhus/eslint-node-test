# no-duplicate-mock-timers-enable

📝 Disallow enabling mock timers more than once without resetting them.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`mock.timers.enable()` throws `ERR_INVALID_STATE` when the same tracker already has its mock timers enabled. Call `mock.timers.reset()` or `mock.reset()` before enabling them again. A reset only clears the tracker it is called on, so it has to be that same tracker.

This rule follows direct `mock.timers` calls on imported global mocks, including suite callbacks, and inline test or hook context parameters. It is control-flow-aware, so a reset must execute on every path before another `enable()` is allowed. A class static block or static field initializer is not a scope of its own, so it shares its state with the code that declares the class: the module body, or the test, suite, or hook callback the class is declared in. To stay simple, aliases, destructuring, computed or optional calls, helper functions, repeated loop iterations, and state shared across separate callbacks are ignored. So is enabling through a different tracker, such as the global `mock.timers` and a context's `t.mock.timers`: it throws only when both calls mock `Date`, which depends on their `apis`. The state a `while` or C-style `for` loop body leaves is not carried past the loop, so `while (condition) { mock.timers.enable(); } mock.timers.enable();` is not reported, unlike the same code with a `for…of`, `for…in` or `do…while` loop.

State changes from a class static block or field initializer that throws are not followed into an enclosing `catch` block. Static initialization is tracked through its normal exits only. In a `finally` block, where the normal path and a `return` path are active at once, a static block applies only what it changed relative to both paths together. So when only some of those paths had enabled before, an `enable()` in a static block there is not added to the paths that had not, and a later duplicate on those paths is missed.

## Examples

```js
import test, {mock} from 'node:test';

// ❌
test('renders after a tick', () => {
	mock.timers.enable();
	mock.timers.enable();
});

// ✅
test('renders after a tick', () => {
	mock.timers.enable();
	mock.timers.reset();
	mock.timers.enable();
});
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

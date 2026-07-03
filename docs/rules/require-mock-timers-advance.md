# require-mock-timers-advance

📝 Require mock timers to be advanced after enabling timer APIs.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`mock.timers.enable()` freezes the mocked clock. Timer callbacks scheduled after that point do not run until the test advances the mocked timers with `tick()` or `runAll()`. If a test enables mocked timers and never advances them, the test can pass while the code under test never actually executes its delayed callback.

This rule reports `mock.timers.enable()` and `t.mock.timers.enable()` inside inline tests, hooks, and subtests when the enabled mocked APIs are never used later in the same callback. Timer APIs (`setTimeout`, `setInterval`, and `setImmediate`) require a later `tick()` or `runAll()` call on the same mock timers object. A `Date`-only mock can also be satisfied by reading the mocked clock with `Date.now()`, `Date()`, or `new Date()`.

The rule intentionally uses simple source-order analysis. It does not try to prove branch reachability, inspect nested helper function bodies, follow helper calls, or match setup in one test or hook with advancement in another.

## Examples

```js
import test from 'node:test';

// ❌
test('delays work', t => {
	t.mock.timers.enable({apis: ['setTimeout']});
	setTimeout(callback, 100);
});

// ✅
test('delays work', t => {
	t.mock.timers.enable({apis: ['setTimeout']});
	setTimeout(callback, 100);
	t.mock.timers.tick(100);
});

// ✅
test('uses a fixed date', t => {
	t.mock.timers.enable({apis: ['Date'], now: 100});
	Date.now();
});
```

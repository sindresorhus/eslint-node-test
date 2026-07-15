# require-mock-timers-advance

📝 Require mock timers to be advanced after enabling timer APIs.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`mock.timers.enable()` freezes the mocked clock. Timer callbacks do not run until the test calls `tick()` or `runAll()`, so enabling mocked timers without advancing them can let a test pass without executing delayed code.

This rule reports `mock.timers.enable()`, `test.mock.timers.enable()`, `it.mock.timers.enable()`, and `t.mock.timers.enable()` in inline tests, hooks, and subtests when timer APIs are enabled without a later advance call in the same callback.

The rule uses simple source-order analysis. It does not prove branch reachability, inspect helper bodies, follow helper calls, match setup in one callback with advancement in another, or prove that timers were scheduled before the advance call.

## Mocked APIs

Timer APIs (`setTimeout`, `setInterval`, and `setImmediate`) require a later `tick()` or `runAll()` call on the same mock timers object. `Date`-only mocks are allowed without advancement.

Non-static or overridden `apis` values are treated conservatively as timer APIs unless the rule can statically see `apis: ['Date']` or `apis: []`.

## Examples

```js
import test from 'node:test';

// ❌
test('delays work', t => {
	t.mock.timers.enable({
		apis: [
			'setTimeout'
		]
	});
	setTimeout(callback, 100);
});

// ✅
test('delays work', t => {
	t.mock.timers.enable({
		apis: [
			'setTimeout'
		]
	});
	setTimeout(callback, 100);
	t.mock.timers.tick(100);
});

// ✅
test('uses a fixed date', t => {
	t.mock.timers.enable({
		apis: [
			'Date'
		],
		now: 100
	});
	Date.now();
});
```

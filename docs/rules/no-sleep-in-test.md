# no-sleep-in-test

📝 Disallow sleeping in tests with `setTimeout`.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Sleeping in a test waits for time instead of the real condition the test needs. This makes the test slower than necessary and still flaky: the event may happen earlier, later, or not at all.

This rule reports direct Promise sleep wrappers inside tests, subtests, and hooks, such as `new Promise(resolve => setTimeout(resolve, 500))`. Await the real signal, or use `t.mock.timers` when you are testing timer-driven code.

## Examples

```js
import test from 'node:test';

// ❌
test('completes work', async () => {
	await new Promise(resolve => setTimeout(resolve, 500));
});

// ✅
test('completes work', async () => {
	await once(emitter, 'done');
});
```

```js
import test from 'node:test';

// ✅
test('debounces', t => {
	t.mock.timers.enable({apis: ['setTimeout']});
	setTimeout(callback, 500);
	t.mock.timers.tick(500);
});
```

The rule intentionally does not report `sleep()` or `delay()` helper calls, or bare `setTimeout(fn, ms)` scheduling. It only targets the direct sleep Promise shape.

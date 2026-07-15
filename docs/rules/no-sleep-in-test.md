# no-sleep-in-test

📝 Disallow sleeping in tests with `setTimeout`.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Sleeping in a test waits for time instead of the real condition the test needs. This makes the test slower than necessary and still flaky: the event may happen earlier, later, or not at all.

This rule reports direct Promise timer wrappers that resolve or reject in test, subtest, and hook callback bodies, such as `new Promise(resolve => setTimeout(resolve, 500))`, and direct `setTimeout()` calls imported from `node:timers/promises` or `timers/promises`. Await the real signal, or use `t.mock.timers` when you are testing timer-driven code.

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
import {setTimeout as delay} from 'node:timers/promises';

// ❌
test('completes work', async () => {
	await delay(500);
});
```

```js
import test from 'node:test';

// ✅
test('debounces', t => {
	t.mock.timers.enable({
		apis: [
			'setTimeout'
		]
	});
	setTimeout(callback, 500);
	t.mock.timers.tick(500);
});
```

The rule intentionally does not report locally defined `sleep()` or `delay()` helper calls, nested helper function bodies, or bare `setTimeout(fn, ms)` scheduling. It only targets direct imported promise-timer `setTimeout()` calls and direct Promise timer wrappers.

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

The rule intentionally does not report locally defined `sleep()` or `delay()` helper calls, the body of a helper function the test only calls, or bare `setTimeout(fn, ms)` scheduling. A callback the test, subtest, or hook call names directly as its body is a test body, so it is followed wherever it is declared. It only targets direct imported promise-timer `setTimeout()` calls and direct Promise timer wrappers.

A statically skipped test's body is not reported, because `node:test` never runs it. A falsy `skip` such as `{skip: 0}` still runs the body of a test or a suite, so that is reported. Limitation: on a suite, a falsy `skip` cancels every test the suite registers, but a sleep in those tests is still reported. A `todo` test is not skipped: its body does run, so a sleep in one is still reported. Limitation: a body named out of line is read through the first call that registers it, so a body shared by a skipped registration and a later live one (`test.skip('a', body); test('b', body);`) is not reported.

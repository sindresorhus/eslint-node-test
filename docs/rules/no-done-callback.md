# no-done-callback

📝 Disallow callback (`done`) parameters in tests and hooks.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`node:test` lets a test or hook opt into callback style by declaring a second `done` parameter, which it then calls to signal completion. Callbacks are easy to get wrong: forget to call `done` and the test hangs until it times out, call it twice and the run errors, and you cannot combine it with a returned Promise. Promises (`async`/`await` or returning a Promise) avoid all of this.

This rule reports a test or hook whose function declares a second parameter (the `done` callback). A second parameter that has a default value or is a rest element is not counted, mirroring how `node:test` computes the arity to decide whether to pass `done`.

This is the broader, opt-in counterpart to [`no-callback-and-promise`](./no-callback-and-promise.md), which only reports the always-failing case of mixing a callback with an `async`/Promise function. If you enable this rule, you can disable `no-callback-and-promise` as redundant.

## Examples

```js
import test from 'node:test';

// ❌
test('title', (t, done) => {
	doSomething(done);
});

// ✅ (async/await)
test('title', async t => {
	await doSomething();
});

// ✅ (return a Promise)
test('title', t => doSomething());
```

# no-callback-and-promise

📝 Disallow a test or hook from using both a callback and a Promise.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A test or hook can be written in either callback style (declare a second `done` parameter and call it) or Promise style (`async`/return a Promise) — but not both. From the [Node.js docs](https://nodejs.org/api/test.html#tests): if the function "receives a callback function and also returns a `Promise`, the test will fail." Node decides whether to pass `done` from the function's arity, so declaring a second parameter on an `async` function always triggers this failure.

This commonly happens when migrating a callback-style test to `async` without removing the now-unused `done` parameter.

This rule reports an `async` test or hook function that also declares a callback parameter. A second parameter that has a default value or is a rest element is not counted, mirroring how `node:test` computes the arity.

## Examples

```js
import test from 'node:test';

// ❌
test('x', async (t, done) => {
	done();
});

// ✅ (Promise style)
test('x', async t => {
	await doSomething();
});

// ✅ (callback style)
test('x', (t, done) => {
	doSomething(done);
});
```

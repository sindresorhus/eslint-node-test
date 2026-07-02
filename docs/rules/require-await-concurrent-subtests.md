# require-await-concurrent-subtests

📝 Require subtests created in a loop callback to be awaited.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A subtest created with `t.test()` returns a promise. Any subtest still outstanding when its parent test finishes is cancelled and treated as a failure. When you create subtests by iterating with `map`, `forEach`, or `flatMap`, you must collect and await the resulting promises, otherwise the parent returns before they settle:

- `forEach` discards its callbacks' return values, so the subtest promises are lost entirely.
- `map`/`flatMap` produce an array of promises that must be consumed, typically with `await Promise.all(...)`.

The `Promise.all(...)` counts as consumed when it is awaited, returned, or assigned. A bare `Promise.all(...)` statement or one discarded with `void` is still flagged, since the parent test finishes before those subtests settle.

This rule complements [`no-unawaited-subtest`](./no-unawaited-subtest.md), which covers a subtest used as a bare statement. It reports a subtest returned from (or used as the expression body of) a `map`/`forEach`/`flatMap` callback whose promises are not consumed.

## Examples

```js
import test from 'node:test';

test('table', async t => {
	// ❌ — subtests are cancelled when the test finishes
	cases.map((input) => t.test(`case ${input}`, () => {}));

	// ❌ — forEach throws the promises away
	cases.forEach((input) => t.test(`case ${input}`, () => {}));

	// ✅
	await Promise.all(cases.map((input) => t.test(`case ${input}`, () => {})));
});
```

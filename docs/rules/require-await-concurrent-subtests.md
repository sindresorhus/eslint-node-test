# require-await-concurrent-subtests

📝 Require subtests created in an array-iteration callback to be awaited.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A subtest created with `t.test()` returns a promise. A subtest that is never awaited starts immediately and runs alongside the rest of the test's own body; awaiting the promises makes the parent wait for every subtest before it continues. When you create subtests by iterating with `map`, `forEach`, or `flatMap`, collect and await the resulting promises to get that ordering:

- `forEach` discards its callbacks' return values, so the subtest promises are lost entirely.
- `map`/`flatMap` produce an array of promises that must be consumed, typically with `await Promise.all(...)`.

Subtests still run one at a time whichever way the promises are collected. Set the [`concurrency`](https://nodejs.org/api/test.html#concurrency) option to run them at the same time.

The `Promise.all(...)` counts as consumed when it is awaited, returned, or assigned. A `Promise.all(...)` whose value a statement throws away (a bare statement, one discarded with `void`, or an operand of a conditional, logical, or sequence expression in such a statement) is still flagged, since nothing there waits for the subtests where the awaited promise would have.

The array has to reach `Promise.all(...)` as a plain argument. The rule does not follow the value any further, so a two-step form that copies it first, as in `await Promise.all([...promises])` or `await Promise.all(promises.slice())`, is still flagged even though the subtests do settle.

This rule complements [`no-unawaited-subtest`](./no-unawaited-subtest.md), which covers a subtest used as a bare statement. It reports a subtest returned from (or used as the expression body of) a `map`/`forEach`/`flatMap` callback whose promises are not consumed.

## Examples

```js
import test from 'node:test';

test('table', async t => {
	// ❌ the test continues while the subtests run
	cases.map((input) => t.test(`case ${input}`, () => {}));

	// ❌ — forEach throws the promises away
	cases.forEach((input) => t.test(`case ${input}`, () => {}));

	// ✅
	await Promise.all(cases.map((input) => t.test(`case ${input}`, () => {})));
});
```

# no-misused-concurrency

📝 Disallow the `concurrency` option on a test without subtests.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

The `concurrency` option controls how many of a suite's tests, or a test's *subtests*, run at the same time. On a leaf test that has no subtests there is nothing for it to govern, so the option does nothing. It is usually a misunderstanding carried over from Jest or Vitest, where concurrency applies to the test itself.

This rule reports the `concurrency` option on a `test`/`it` (or a subtest) whose callback creates no subtests. Use it on a `describe`/`suite`, or on a test that creates subtests with `t.test()`.

> [!NOTE]
> A subtest counts when it is created on the test's own context, including from a helper function declared inside the test callback, where that context is still in scope. A helper declared outside the callback, or a subtest on an unrelated context, is not counted. Only a subtest created through a test context counts: an imported `test()` or `describe()` called in the test body also runs as a subtest that `concurrency` governs, but it is not counted, so the option is still reported. Create the subtests with `t.test()` instead, which [`no-nested-tests`](./no-nested-tests.md) asks for too. Only an inline callback, or a test with no callback, is checked. Any other callback, such as `body` in `test('t', {concurrency: true}, body)`, an imported function, `helpers.body` or `makeBody()`, is not checked, since its subtests are declared away from the test.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert';

// ❌ — no subtests, so `concurrency` does nothing
test('does work', {concurrency: true}, () => {
	assert.ok(result);
});

// ✅ — governs how the subtests run
test('group', {concurrency: true}, async t => {
	await t.test('a', () => {});
	await t.test('b', () => {});
});
```

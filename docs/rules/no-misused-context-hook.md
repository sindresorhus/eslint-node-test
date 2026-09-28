# no-misused-context-hook

📝 Disallow context hooks without runnable subtests.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`t.beforeEach()` and `t.afterEach()` run around the current test's subtests. On a test without runnable subtests, there is nothing for them to run around, so their callbacks do nothing. Put the setup or cleanup directly in the test, or create subtests.

A statically skipped child, such as one with `{skip: true}`, does not count as runnable. A child with `{todo: true}` is still runnable, so its hooks are meaningful. `t.test` is a plain function with no `skip`, `only` or `todo` method, so a chained call like `t.test.only(…)` is a `TypeError` that registers nothing, and the hook is reported.

The rule also ignores callbacks of statically skipped tests and suites. Node does not run the body of a test whose `skip` is truthy. A falsy `skip` other than `false`, such as `{skip: 0}`, still marks the test `# SKIP` but runs its body, so the hooks in it are checked; the same value on a suite runs its body but cancels every test it registers, so those tests are ignored. A subtest written in an array-method callback, in `Array.from`'s mapping argument, or in a suite body still counts: each runs synchronously, so the subtest is registered before the test body finishes and the hooks really do run around it.

This rule considers subtest calls in the same test callback, in either the `<context>.test(…)` or the imported `test(…)` spelling, including ones written in a function the callback invokes right there (an immediately invoked function) or in an array-method iteration callback or a loop body. A context hook written inside such a function is not found, so it is not reported. It does not follow a call to a declared helper, and does not model control flow or registration order.

Those array methods are recognised by name, not by what the receiver is, so a callback passed to a same-named method on some other object, such as a collection type whose `map` does not call the function, counts as a subtest even though nothing is registered.

> [!NOTE]
> `t.before()` and `t.after()` are not reported because they run for the current test, including a test without subtests.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert/strict';

// ❌
test('does work', t => {
	t.beforeEach(() => {
		prepare();
	});

	assert.equal(result, expected);
});

// ✅
test('group', async t => {
	t.beforeEach(() => {
		prepare();
	});

	await t.test('does work', () => {
		assert.equal(result, expected);
	});
});
```

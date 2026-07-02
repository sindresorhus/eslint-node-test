# no-skip-without-reason

📝 Require a reason when skipping or marking a test as todo.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A skipped or todo test with no explanation leaves the next reader guessing why it is disabled and whether it is safe to re-enable. `node:test` lets you attach a reason: the `skip`/`todo` options accept a string, and the test context methods `t.skip()` / `t.todo()` accept a message that is shown in the test results.

This rule reports `{skip: true}` / `{todo: true}` options (where a reason string should be used instead) and `t.skip()` / `t.todo()` calls with no message. It is off by default.

Chained modifiers (`test.skip(…)`) have no way to attach a reason, so they are not reported; use the options form with a reason instead.

## Examples

```js
import test from 'node:test';

// ❌
test('flaky thing', {skip: true}, () => {});
test('wip', t => {
	t.todo();
});

// ✅
test('flaky thing', {skip: 'fails intermittently, see #123'}, () => {});
test('wip', t => {
	t.todo('blocked on the parser rewrite');
});
```

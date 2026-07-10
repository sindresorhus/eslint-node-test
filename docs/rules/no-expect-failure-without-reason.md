# no-expect-failure-without-reason

📝 Require a reason when marking a test or suite as expected to fail.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

An expected-failure test passes only when it fails. Without an explanation, readers cannot tell which known problem it tracks or when it should be re-enabled. `node:test` accepts a reason string for `expectFailure`.

This rule reports `{expectFailure: true}` options on tests and suites. It is off by default.

Chained modifiers (`test.expectFailure(…)`) have no way to attach a reason, so they are not reported; use the options form with a reason instead. Matcher values, including `RegExp` and `{label, match}` objects, are also not reported.

## Examples

```js
import test from 'node:test';

// ❌
test('new behavior', {expectFailure: true}, () => {
	// …
});

// ✅
test('new behavior', {expectFailure: 'blocked on #123'}, () => {
	// …
});
```

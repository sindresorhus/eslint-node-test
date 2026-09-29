# no-expect-failure-without-reason

📝 Require a reason when marking a test or suite as expected to fail.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

An expected-failure test passes only when it fails. Without an explanation, readers cannot tell which known problem it tracks or when it should be re-enabled. `node:test` accepts a reason string for `expectFailure`.

This rule reports an `expectFailure` option that carries no reason on tests and suites. `node:test` reads a string, a function, a `RegExp`, or an object as the reason or matcher, and turns the expected failure on for everything else except `undefined` and `false`, so `{expectFailure: true}`, `{expectFailure: 1}`, and a constant bound to `true` are all reported. An empty string is reported too: it turns the expected failure on with no reason. It is enabled in the `recommended` config.

Chained modifiers (`test.expectFailure(…)`) have no way to attach a reason, so they are not reported; use the options form with a reason instead. Matcher values, including `RegExp` and `{label, match}` objects, are also not reported. A value the runner rejects outright (`null`, or an object with no own enumerable keys such as `{}` or `[]`) is reported, because it carries no reason either.

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

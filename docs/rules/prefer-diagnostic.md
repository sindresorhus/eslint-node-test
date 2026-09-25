# prefer-diagnostic

📝 Prefer the test context `diagnostic()` over `console` inside tests.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`console.log()` inside a test writes to the process output stream, detached from the test runner's structured reporting. The test context's `diagnostic()` method emits the message as a TAP diagnostic tied to the test, so it shows up in the right place in reporters and is not mistaken for application output.

This rule reports `console.log()` / `console.info()` / `console.debug()` calls inside a test callback, including one reached through `globalThis.console` or `global.console`, one in a hook declared on the test's context, and one in a function declared inside the callback, and suggests the context's `diagnostic()`. A test that declares no context parameter is covered too when the file imports `getTestContext`, in which case the suggestion is `getTestContext().diagnostic()`. Calls in the test's title or options arguments, and in a `describe` callback, are left alone: the first are not in the context's scope, and the second are registration-time code the callback body does not run. `console.error()` and `console.warn()` are also left alone, since they often signal genuine problems. It is off by default.

## Examples

```js
import test from 'node:test';

test('reports progress', t => {
	// ❌
	console.log('processed 10 items');

	// ✅
	t.diagnostic('processed 10 items');
});
```

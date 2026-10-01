# prefer-diagnostic

📝 Prefer the test context `diagnostic()` over `console` inside tests.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`console.log()` inside a test writes to the process output stream, detached from the test runner's structured reporting. The test context's `diagnostic()` method emits the message as a TAP diagnostic tied to the test, so it shows up in the right place in reporters and is not mistaken for application output.

This rule reports `console.log()` / `console.info()` / `console.debug()` calls inside a test callback, written inline or named out of line (`test('a', body)`), including one reached through `globalThis.console` or `global.console`, one in a hook declared on the test's context, and one in a function declared inside the callback, and suggests the context's `diagnostic()`. In a hook that declares a context parameter (`t.beforeEach(ctx => …)`), the suggestion uses that parameter, since the runner passes the hook a context of its own. A test that declares no context parameter is covered too when the file imports `getTestContext`, in which case the suggestion is `getTestContext().diagnostic()`. Calls in the test's title or options arguments, and in a `describe` callback, are left alone: the first are not in the context's scope, and the second are registration-time code the callback body does not run. `console.error()` and `console.warn()` are also left alone, since they often signal genuine problems. It is off by default.

The suggestion is only offered for a single argument that is statically a string: a string literal, a template literal, or a `+` concatenation with one of those as an operand. `diagnostic()` takes one string message, and under `node --test` a `t.diagnostic(undefined)` or `t.diagnostic(null)` call fails the whole file while an object prints `[object Object]`. Any other call is still reported, without a suggestion.

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

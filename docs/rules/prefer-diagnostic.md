# prefer-diagnostic

📝 Prefer the test context `diagnostic()` over `console` inside tests.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`console.log()` inside a test writes to the process output stream, detached from the test runner's structured reporting. The test context's `diagnostic()` method emits the message as a TAP diagnostic tied to the test, so it shows up in the right place in reporters and is not mistaken for application output.

This rule reports `console.log()` / `console.info()` / `console.debug()` calls inside the callback body of a test that has a context parameter, and suggests `t.diagnostic()`. Calls in the test's title or options arguments are ignored, since the context is not in scope there. `console.error()` and `console.warn()` are left alone, since they often signal genuine problems. It is off by default.

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

# no-skip-without-return

📝 Disallow `t.skip()`/`t.todo()` without returning afterwards.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`t.skip()` and `t.todo()` mark the test as skipped or todo, but they do **not** stop execution — any code after them still runs. From the [Node.js docs](https://nodejs.org/api/test.html#contextskipmessage): the call "does not terminate execution of the test function." So assertions placed after a conditional `t.skip()` run even when the test was meant to be skipped, often failing or causing side effects.

This rule reports a `t.skip()`/`t.todo()` call that is followed by reachable code. The suggestion inserts a `return` after it. Where a test should always be skipped, prefer the `{skip: true}` / `{todo: true}` option instead, which never runs the test body.

## Examples

```js
import test from 'node:test';

// ❌
test('x', t => {
	if (notReady) {
		t.skip('dependency unavailable');
	}

	assert.ok(compute()); // runs even when skipped
});

// ✅
test('x', t => {
	if (notReady) {
		t.skip('dependency unavailable');
		return;
	}

	assert.ok(compute());
});

// ✅ (always skipped — body never runs)
test('x', {skip: 'dependency unavailable'}, t => {
	assert.ok(compute());
});
```

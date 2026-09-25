# no-unawaited-subtest

📝 Require subtests created with the test context to be awaited or returned.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Subtests created through the test context (`t.test()`) return a promise, and a subtest that is never awaited still runs: it starts immediately and overlaps the rest of the test's own body. Awaiting it makes the parent wait for the child before it continues, which is what keeps a test's assertions and teardown from interleaving with its subtests. Nothing is lost either way, since the parent waits for its subtests before it finishes, but a parent that fails or times out first cancels the outstanding subtest with `test did not finish before its parent and was cancelled`.

This rule reports a subtest call used as a bare statement. When the enclosing test function is `async`, it autofixes by inserting `await`. In a synchronous parent it only reports, since `await` would be a syntax error — make the parent `async` (or `return` the subtest) yourself.

Discarding the subtest with `void` does not help — it still leaves the subtest unawaited — so it is reported too (without an autofix).

## Examples

```js
import test from 'node:test';

// ❌
test('parent', async t => {
	t.test('child', () => {});
});

// ❌
test('parent', async t => {
	void t.test('child', () => {}); // `void` discards the Promise but leaves the subtest unawaited
});

// ✅
test('parent', async t => {
	await t.test('child', () => {});
});

// ✅ (returned)
test('parent', t => t.test('child', () => {}));

// ✅ (run concurrently, then awaited)
test('parent', async t => {
	await Promise.all([
		t.test('a', () => {}),
		t.test('b', () => {})
	]);
});
```

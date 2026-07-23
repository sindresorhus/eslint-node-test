# no-unawaited-subtest

📝 Require subtests created with the test context to be awaited or returned.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Subtests created through the test context (`t.test()`) run independently of their parent. From the [Node.js docs](https://nodejs.org/api/test.html#subtests): "tests do not wait for their subtests to complete... Any subtests that are still outstanding when their parent finishes are cancelled and treated as failures." A floating subtest therefore fails with `test did not finish before its parent and was cancelled`, and the parent fails too.

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

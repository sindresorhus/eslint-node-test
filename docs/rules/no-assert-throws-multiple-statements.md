# no-assert-throws-multiple-statements

📝 Disallow multiple statements in `assert.throws()`/`assert.rejects()` callbacks.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.throws()` and `assert.rejects()` pass when their callback throws or rejects with the expected error. If the callback also performs setup work, a setup error can satisfy the assertion before the code under test runs.

Keep the callback focused on the single operation expected to fail. Move setup outside the assertion.

This rule reports inline `throws()` and `rejects()` callbacks resolved from `node:assert`, including named imports, strict namespace forms, optional member calls, and `t.assert` from `node:test`. It intentionally does not inspect callback identifiers, computed assertion calls, or nested blocks.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.throws(() => {
	setup();
	run();
});

// ✅
setup();
assert.throws(() => run());

// ✅
setup();
assert.throws(() => {
	run();
});
```

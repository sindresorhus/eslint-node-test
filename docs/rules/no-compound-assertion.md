# no-compound-assertion

📝 Disallow compound truthiness assertions.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A compound truthiness assertion like `assert.ok(a && b)` hides which operand failed. Splitting it into separate assertions gives a focused failure location and keeps the assertion output useful.

This rule reports `assert()`/`assert.ok()`/named `ok()`/test-context `t.assert.ok()` calls whose asserted value is a top-level `&&` chain.

It autofixes standalone single-argument assertions into one assertion per operand. It does not fix assertions with custom messages, comments, same-line surrounding code/comments, braceless control-flow parents, or `t.plan()` counts.

Test-context assertions are recognized in tests, subtests, and hooks.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.ok(user.isActive && user.hasEmail);
assert.ok(a && b && c);

// ✅
assert.ok(user.isActive);
assert.ok(user.hasEmail);
assert.ok(a);
assert.ok(b);
assert.ok(c);
```

# no-identical-assertion-arguments

📝 Disallow comparing a value to itself in an assertion.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A `node:assert` comparison whose two operands are the same reference is a mistake: an equality check like `assert.strictEqual(x, x)` always passes, and a negated check like `assert.notStrictEqual(x, x)` always fails, regardless of the code under test. This usually means the wrong variable was passed to one side.

This rule reports the two-operand comparisons (`equal`, `strictEqual`, `deepEqual`, `deepStrictEqual` and their `not*` variants) when both operands are the same reference. Operands containing a function call (`assert.strictEqual(read(), read())`) are not reported, since the two calls can legitimately return different values.

## Examples

```js
import assert from 'node:assert/strict';

// ❌ — always passes
assert.strictEqual(user.name, user.name);

// ❌ — always fails
assert.notStrictEqual(total, total);

// ✅
assert.strictEqual(user.name, 'Ada');
```

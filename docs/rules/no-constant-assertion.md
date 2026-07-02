# no-constant-assertion

📝 Disallow assertions with constant outcomes.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Assertions should depend on the behavior under test. An assertion whose result is fully determined by static values always passes or always fails before the test code can affect it. This usually means the wrong value was asserted, a fixture was left behind, or an assertion was being used as an unreachable marker.

Use `assert.fail()` for intentional unreachable code. This rule reports `assert(false)` and `assert.ok(false)` because their outcome is still constant.

This rule reports `ok`, bare `assert()`, `ifError`, equality assertions, and match assertions with a static asserted value and regex literal pattern.

For match assertions, this rule intentionally only evaluates regex literal patterns.

## Examples

```js
import assert from 'node:assert/strict';

// ❌
assert.ok(true);
assert(false);
assert.strictEqual(1, 1);
assert.match('hello', /ell/);

// ✅
assert.ok(result);
assert.strictEqual(actual, expected);
assert.fail('unreachable');
```

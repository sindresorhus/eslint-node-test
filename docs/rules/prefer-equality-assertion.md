# prefer-equality-assertion

📝 Prefer an equality assertion over a truthiness assertion on a comparison.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Asserting a comparison through a truthiness assertion (`assert(actual === expected)` or `assert.ok(actual === expected)`) throws away the diagnostic. On failure, Node only reports that the expression evaluated to a falsy value:

```text
AssertionError: The expression evaluated to a falsy value:

  assert.ok(actual === expected)
```

The dedicated equality assertion reports both values and a diff instead, which is far easier to debug.

This rule reports `assert()`/`assert.ok()` calls whose argument is an equality comparison and autofixes to the assertion that preserves the operator's semantics. Relational comparisons (`<`, `>`, `<=`, `>=`) are not reported because `node:assert` has no equivalent assertion.

| Operator | Replacement |
|---|---|
| `===` | `strictEqual` |
| `!==` | `notStrictEqual` |
| `==` | `equal` |
| `!=` | `notEqual` |

Loose `==`/`!=` comparisons are not reported when using a strict assert API because `equal`/`notEqual` would behave strictly there and change the assertion semantics.

The fix is skipped (the problem is still reported) when the comparison is wrapped in extra parentheses or contains a comment, since the rewrite could not safely preserve it.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.ok(actual === expected);
assert(actual !== expected);
assert.ok(actual === expected, 'should match');

// ✅
assert.strictEqual(actual, expected);
assert.notStrictEqual(actual, expected);
assert.strictEqual(actual, expected, 'should match');
```

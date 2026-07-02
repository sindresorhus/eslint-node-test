# no-incorrect-strict-equal

📝 Disallow `strictEqual`/`equal` (and their `not*` variants) when comparing with an object or array literal.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`strictEqual` and `equal` (and their `not*` variants) compare with `Object.is` / `==`. When an argument is an object or array literal, that comparison is decided purely by reference identity: a freshly allocated `{…}` or `[…]` is never reference-equal to anything else. So `strictEqual(value, {a: 1})` always fails and `notStrictEqual(value, {a: 1})` always passes, regardless of `value`. The author almost always meant a deep structural comparison.

This rule reports `equal`, `strictEqual`, `notEqual`, and `notStrictEqual` calls where either argument is an object or array literal. It autofixes by replacing the method name with the deep equivalent.

This is the mirror of [`no-incorrect-deep-equal`](./no-incorrect-deep-equal.md), which flags the opposite mistake (deep comparison against a primitive).

| Method | Replacement |
|---|---|
| `equal` | `deepEqual` |
| `strictEqual` | `deepStrictEqual` |
| `notEqual` | `notDeepEqual` |
| `notStrictEqual` | `notDeepStrictEqual` |

## Examples

```js
import assert from 'node:assert';

// ❌
assert.strictEqual(actual, {key: 'value'});
assert.equal(actual, [1, 2, 3]);
assert.notStrictEqual(actual, {});

// ✅
assert.deepStrictEqual(actual, {key: 'value'});
assert.deepEqual(actual, [1, 2, 3]);
assert.notDeepStrictEqual(actual, {});

// ✅ (primitives — strict comparison is appropriate)
assert.strictEqual(actual, 42);
assert.equal(actual, 'expected string');
```

# prefer-strict-assert

📝 Prefer strict assertion methods over their legacy loose counterparts.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

The legacy `assert.equal`, `assert.deepEqual`, `assert.notEqual`, and `assert.notDeepEqual` methods compare with the `==` operator ([Stability: 3 - Legacy](https://nodejs.org/api/assert.html#comparison-details)). Loose comparison hides real bugs: `assert.equal(1, '1')` passes, as does `assert.deepEqual({a: 1}, {a: '1'})`. Their strict counterparts use `===` and produce a clear diff on failure.

This rule reports the loose methods and autofixes them to the strict equivalent.

| Loose method | Replacement |
|---|---|
| `equal` | `strictEqual` |
| `notEqual` | `notStrictEqual` |
| `deepEqual` | `deepStrictEqual` |
| `notDeepEqual` | `notDeepStrictEqual` |

The rule does not report files that import from `node:assert/strict`, where the loose methods are already aliases of their strict counterparts. The test context's `t.assert` is always loose mode, so its methods are reported.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.equal(actual, expected);
assert.deepEqual(actual, {key: 'value'});
assert.notEqual(actual, expected);

// ✅
assert.strictEqual(actual, expected);
assert.deepStrictEqual(actual, {key: 'value'});
assert.notStrictEqual(actual, expected);
```

```js
import assert from 'node:assert/strict';

// ✅ (strict mode — `equal` is an alias of `strictEqual`)
assert.equal(actual, expected);
```

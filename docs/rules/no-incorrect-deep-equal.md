# no-incorrect-deep-equal

📝 Disallow `deepEqual`/`deepStrictEqual` (and their `notDeep*` variants) when comparing with primitives.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`deepEqual` and `deepStrictEqual` (and their `notDeep*` variants) perform deep structural comparison, which is unnecessary and misleading when one of the arguments is a primitive value. A primitive has no structure to recurse into, so a shallow equality comparison is the simpler assertion.

This rule reports `deepEqual`, `deepStrictEqual`, `notDeepEqual`, and `notDeepStrictEqual` calls where either argument is a primitive literal. It autofixes by replacing the method name with the non-deep equivalent. Only the strict pair (`deepStrictEqual`, `notDeepStrictEqual`) is autofixed: `deepStrictEqual` and `strictEqual` agree on every primitive. The loose pair (`deepEqual` -> `equal`) is reported but not fixed, because `==` coerces a value that loose deep equality does not — `deepEqual(0, [])` fails while `equal(0, [])` passes.

| Deep method | Replacement |
|---|---|
| `deepEqual` | `equal` |
| `deepStrictEqual` | `strictEqual` |
| `notDeepEqual` | `notEqual` |
| `notDeepStrictEqual` | `notStrictEqual` |

## Examples

```js
import assert from 'node:assert';

// ❌
assert.deepEqual(actual, 'expected string');
assert.deepStrictEqual(42, actual);
assert.notDeepEqual(actual, null);

// ✅
assert.equal(actual, 'expected string');
assert.strictEqual(42, actual);
assert.notEqual(actual, null);

// ✅ (non-primitives — deep comparison is appropriate)
assert.deepEqual(actual, {key: 'value'});
assert.deepStrictEqual(actual, [1, 2, 3]);
```

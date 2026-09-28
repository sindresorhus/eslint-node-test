# prefer-strict-assert

📝 Prefer strict assertion methods over their legacy loose counterparts.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

The legacy `assert.equal`, `assert.deepEqual`, `assert.notEqual`, and `assert.notDeepEqual` methods compare with the `==` operator ([Stability: 3 - Legacy](https://nodejs.org/api/assert.html#comparison-details)). Loose comparison hides real bugs: `assert.equal(1, '1')` passes, as does `assert.deepEqual({a: 1}, {a: '1'})`. Their strict counterparts produce a clear diff on failure, and compare with `Object.is` semantics for the primitive methods (`assert.strictEqual(NaN, NaN)` passes and `assert.strictEqual(0, -0)` fails, which `===` would not do) and a deep structural comparison for `deepStrictEqual`.

This rule reports the loose methods and autofixes them to the strict equivalent. A bare named import (`equal(a, b)`) is reported without a fix, since rewriting it would name a method the file does not import. The same goes for a bare named import behind a TypeScript wrapper, such as `(equal as any)(a, b)` or `equal!(a, b)`, which is the same call with the cast erased. A cast around the member form, `(assert as any).equal(a, b)`, is still fixed.

The strict methods compare with `Object.is` where the loose ones use `==`, so a pair the rewrite would flip is reported without a fix. That is `0` against `-0`, `null` against `undefined`, and any pair the loose comparison coerces between types, such as `'1'` and `1`. `NaN` is the one pair the two agree on, since the loose methods already treat it as equal to itself, so `assert.equal(NaN, NaN)` is still fixed. A pair where the rule can resolve both sides and either one is an object or array is also reported without a fix, since the loose methods coerce it where the strict ones do not: `assert.equal([1], 1)` and `assert.deepEqual([1], ['1'])` pass, while their strict counterparts fail. A pair the rule cannot resolve is left to the runtime, which is where the difference shows up, so `assert.deepEqual(actual, {a: 1})` is still fixed.

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

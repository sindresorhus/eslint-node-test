# prefer-assert-match

📝 Prefer `assert.match()`/`assert.doesNotMatch()` over asserting `RegExp#test()` / `String#match()` results.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Prefer dedicated assertion methods over asserting the boolean result of regex methods. This makes test failures more informative and communicates the intent more clearly.

`String#match()` returns `Array | null`, not a boolean, so only its truthiness forms (like `assert.ok(str.match(/re/))`) are matched. Comparing the result to a boolean literal is a test bug rather than a style issue, and rewriting it would change the outcome, so the rule leaves it alone.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.ok(/^foo/.test(str));
assert.ok(str.match(/^foo/));
assert.strictEqual(/^foo/.test(str), true);

// ✅
assert.match(str, /^foo/);
```

```js
import assert from 'node:assert';

// ❌
assert.ok(!/^foo/.test(str));
assert.strictEqual(/^foo/.test(str), false);
assert.notStrictEqual(/^foo/.test(str), true);

// ✅
assert.doesNotMatch(str, /^foo/);
```

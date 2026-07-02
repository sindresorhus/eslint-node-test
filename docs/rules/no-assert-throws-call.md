# no-assert-throws-call

📝 Disallow calling the function passed to `assert.throws()`.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.throws()` must receive a function that it can call and catch. Passing the result of a call, like `assert.throws(parse(input))`, runs `parse(input)` before `assert.throws()` starts. If that call throws, the error escapes the assertion entirely.

This rule reports direct calls passed as the first argument to `assert.throws()`. Calls that obviously produce functions, like `.bind()` and `Function()`, are ignored. Other function factories are intentionally not guessed; if a factory call is valid in your test, pass a named callback or disable the rule for that line.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.throws(parse(input), SyntaxError);

// ✅
assert.throws(() => parse(input), SyntaxError);
```

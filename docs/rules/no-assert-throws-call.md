# no-assert-throws-call

📝 Disallow calling the function passed to `assert.throws()`.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.throws()` must receive a function that it can call and catch. Passing the result of a call, like `assert.throws(parse(input))`, runs `parse(input)` before `assert.throws()` starts. If that call throws, the error escapes the assertion entirely.

This rule reports a first argument that does work while it is evaluated, whether that work is the argument itself (`assert.throws(parse(input))`, `assert.throws(new Parser(input))`, `assert.throws(tag`input`)`) or somewhere inside it (`assert.throws(flag ? parse(a) : parse(b))`, `assert.throws(await getCallback())`). Calls that obviously produce the function to hand over, like `.bind()`, `Function()`, and `new Function()`, are ignored. A nested function is not evaluated here, so `assert.throws(() => parse(input))` is the fix rather than a problem. Other function factories are intentionally not guessed; if a factory call is valid in your test, assign the factory result to a variable before passing it or disable the rule for that line.

The suggestion wraps the argument in an arrow function, which is `async` when the argument awaits. An argument that contains a `yield` is reported without a suggestion, since an arrow cannot hold one.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.throws(parse(input), SyntaxError);

// ✅
assert.throws(() => parse(input), SyntaxError);
```

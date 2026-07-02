# prefer-assert-throws-block

📝 Prefer block-bodied callbacks in `assert.throws()`.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.throws()` callbacks are for running code for its synchronous throwing behavior, not for returning a value. A block body makes that intent explicit and avoids the callback looking like the expression result matters.

This rule reports concise-body arrow callbacks passed to `assert.throws()` and fixes them to block-bodied callbacks.

Autofix is skipped for `async` callbacks and callbacks with an explicit return type, where discarding the expression result could change behavior or break the declared type.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.throws(() => parse(input), SyntaxError);

// ✅
assert.throws(() => {
	parse(input);
}, SyntaxError);
```

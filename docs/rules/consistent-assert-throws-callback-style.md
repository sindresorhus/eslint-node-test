# consistent-assert-throws-callback-style

📝 Enforce a consistent body style for `assert.throws()` callbacks.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.throws()` callbacks can be written with a block body or an expression body. Mixing both styles in a codebase is inconsistent. This rule enforces one.

It is off by default. Enable it with the `style` you prefer.

Under the default `block` style, expression-body arrow callbacks are fixed to block-bodied callbacks. The original expression is evaluated as an expression statement and intentionally not returned.

Under the `expression` style, only block callbacks with a single expression statement are reported, since multi-statement blocks and statements like `throw` have no expression-body equivalent.

Autofix is skipped for `async` callbacks and callbacks with an explicit return type, where changing the callback body form could change behavior or break the declared type.

Autofix is also skipped when comments would be unsafe to preserve while moving the expression.

## Options

- `style` (`'block'` | `'expression'`, default `'block'`) — which callback body style to require.

```js
{
	'node-test/consistent-assert-throws-callback-style': ['error', {style: 'block'}]
}
```

## Examples

With the default `{style: 'block'}`:

```js
import assert from 'node:assert';

// ❌
assert.throws(() => parse(input), SyntaxError);

// ✅
assert.throws(() => {
	parse(input);
}, SyntaxError);
```

With `{style: 'expression'}`:

```js
import assert from 'node:assert';

// ❌
assert.throws(() => {
	parse(input);
}, SyntaxError);

// ✅
assert.throws(() => parse(input), SyntaxError);
```

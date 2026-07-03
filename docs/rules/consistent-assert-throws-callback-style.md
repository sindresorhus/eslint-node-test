# consistent-assert-throws-callback-style

📝 Enforce a consistent body style for `assert.throws()` arrow callbacks.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Enforces block or expression bodies for `assert.throws()` arrow callbacks.

It is off by default. Set your preferred `style`.

The default `block` style fixes expression bodies to block bodies. The original expression is evaluated as a non-returned expression statement.

The `expression` style reports only single-expression block bodies. Multi-statement blocks and `throw` cannot be converted.

Autofix is skipped for `async` callbacks, explicit return types, unsafe comment moves, and split-line arrows.

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

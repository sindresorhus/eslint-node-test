# consistent-assert-style

📝 Enforce a consistent truthiness assertion style.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert(value)` and `assert.ok(value)` are aliases. Mixing both styles is cosmetic noise, so this rule enforces one truthiness assertion form.

The default is the shorter `assert(value)` form. If you prefer the explicit method form, set `style: 'assert-ok'`.

This rule only targets callable imports from `node:assert`, `node:assert/strict`, `assert`, and `assert/strict`. It intentionally ignores `t.assert.ok(value)`, because the test context's `assert` is an object of assertion methods, not a callable function.

## Options

```js
{
	'node-test/consistent-assert-style': ['error', {
		style: 'assert', // 'assert' | 'assert-ok', default: 'assert'
	}]
}
```

## Examples

With the default (`style: 'assert'`):

```js
import assert from 'node:assert/strict';

// ❌
assert.ok(value);

// ✅
assert(value);
```

With `style: 'assert-ok'`:

```js
import assert from 'node:assert/strict';

// ❌
assert(value);

// ✅
assert.ok(value);
```

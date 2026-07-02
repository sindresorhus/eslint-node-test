# consistent-assert-style

📝 Enforce a consistent truthiness assertion style.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert(value)` and `assert.ok(value)` are aliases. This rule enforces one form.

The default is `assert.ok(value)`: explicit and consistent with the rest of the assert API (`strictEqual`, `match`, `throws`, `ok`). If you prefer the shorter alias, set `style: 'assert'`.

This rule only targets callable imports from `node:assert`, `node:assert/strict`, `assert`, and `assert/strict`. It ignores `t.assert.ok(value)`, because `t.assert` is not callable.

If you set `style: 'assert'`, do not also enable eslint-plugin-unicorn's [`consistent-assert`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-assert.md), which enforces `assert.ok(value)`.

## Options

```js
{
	'node-test/consistent-assert-style': [
		'error',
		{
			style: 'assert-ok', // 'assert' | 'assert-ok', default: 'assert-ok'
		}
	]
}
```

## Examples

With the default (`style: 'assert-ok'`):

```js
import assert from 'node:assert/strict';

// ❌
assert(value);

// ✅
assert.ok(value);
```

With `style: 'assert'`:

```js
import assert from 'node:assert/strict';

// ❌
assert.ok(value);

// ✅
assert(value);
```

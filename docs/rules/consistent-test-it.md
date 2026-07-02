# consistent-test-it

📝 Enforce consistent use of `test` or `it`.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`test` and `it` are aliases. Mixing them in a codebase is purely cosmetic noise — it usually signals copy-pasted code or inconsistent conventions. This rule enforces a single choice, optionally a different one at the top level versus inside a `describe` (the common `test()` / `describe(() => it())` style).

## Options

```js
{
	'node-test/consistent-test-it': ['error', {
		fn: 'test', // 'test' | 'it' — name for top-level test cases (default: 'test')
		withinDescribe: 'it', // 'test' | 'it' — name inside a `describe` (default: 'it')
	}]
}
```

## Examples

With the defaults (`fn: 'test'`, `withinDescribe: 'it'`):

```js
import {test, it, describe} from 'node:test';

// ❌
it('runs', () => {}); // top level should use `test`

describe('group', () => {
	test('runs', () => {}); // inside `describe` should use `it`
});

// ✅
test('runs', () => {});

describe('group', () => {
	it('runs', () => {});
});
```

# require-mock-timers-apis

📝 Require an explicit `apis` option when enabling `mock.timers`.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`mock.timers.enable()` defaults to mocking all timer APIs, including the global `Date` object. That can break unrelated code in the same test or hook that expects real wall-clock time, such as logging, cache TTLs, or timestamp comparisons.

This rule requires an explicit `apis` property so the test states exactly which timer APIs it intends to mock. It checks the global `mock` export, `test.mock`, test and hook context mocks like `t.mock`, and direct `getTestContext().mock` access inside tests where that Node.js API is available.

## Examples

```js
import {test} from 'node:test';

test('debounce', t => {
	t.mock.timers.enable(); // ❌ also mocks `Date`
});
```

```js
import {test} from 'node:test';

test('debounce', t => {
	t.mock.timers.enable({apis: ['setTimeout']});
});
```

Variable option objects are ignored, since the rule cannot statically know whether they include `apis`. Object literals must include a visible `apis` property after any spread, and statically missing values or non-options values like `undefined`, `null`, `false`, or `[]` are reported. Aliases and destructuring of `t.mock` are intentionally not followed.

# no-unneeded-async-rejects-callback

📝 Disallow unneeded async callbacks passed to `assert.rejects()`.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.rejects()` accepts either a Promise or a function that returns a Promise. Wrapping a single awaited operation in an `async` callback adds syntax without changing how the rejection is tested.

Use a plain Promise-returning callback instead. Keeping the callback, rather than passing an already-created Promise, preserves lazy invocation and argument evaluation order.

This rule reports parameterless async callbacks whose entire body is one awaited expression. Callbacks with parameters, additional statements, or control flow are ignored.

## Examples

```js
import assert from 'node:assert/strict';

// ❌
await assert.rejects(async () => await operation());

// ✅
await assert.rejects(() => operation());
```

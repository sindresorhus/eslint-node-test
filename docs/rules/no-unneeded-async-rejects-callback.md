# no-unneeded-async-rejects-callback

📝 Disallow unneeded async callbacks passed to `assert.rejects()`.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.rejects()` accepts a Promise or a Promise-returning function. This rule finds parameterless async callbacks that only await a built-in `Promise` and suggests removing `async` and `await`. It keeps the callback so the operation remains lazy.

With [typed linting](https://typescript-eslint.io/getting-started/typed-linting/), the rule verifies that the awaited value is a built-in `Promise`. Without type information, it only reports zero-argument calls to unreassigned local async function declarations or inline async functions. It ignores `PromiseLike`, other non-Promise values, and callbacks with parameters, additional statements, or control flow.

Review the suggestion before applying it. TypeScript can verify the Promise type but cannot prove that evaluating the awaited expression will not throw synchronously. Without the async wrapper, a synchronous error bypasses the `assert.rejects()` matcher, so the rule remains opt-in.

## Examples

```ts
import assert from 'node:assert/strict';

declare const operation: () => Promise<void>;

// ❌
await assert.rejects(async () => await operation());

// ✅
await assert.rejects(() => operation());
```

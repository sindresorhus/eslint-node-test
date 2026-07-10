# no-conflicting-modifiers

📝 Disallow conflicting test modifiers.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A test can be marked with at most one of `only`, `skip`, `todo`, or expected failure. Setting more than one — whether chained (`test.skip.only(…)`), through the options object (`{skip: true, only: true}`), or with `expectFailure()` — does not combine them: `node:test` silently applies a single one by precedence, so the author's intent is quietly lost.

This rule reports a test, suite, or hook that has two or more of `only`/`skip`/`todo`/expected-failure active at once, across the chained, options-object, and `expectFailure()` forms. A modifier explicitly set to `false` (for example `{skip: false}`) is treated as inactive, and the same modifier set twice is redundant rather than conflicting.

## Examples

```js
import test, {expectFailure} from 'node:test';

// ❌
test.skip.only('title', () => {});

// ❌
test('title', {skip: true, only: true}, () => {});

// ❌
expectFailure('title', {skip: true}, () => {});

// ✅
test.skip('title', () => {});
```

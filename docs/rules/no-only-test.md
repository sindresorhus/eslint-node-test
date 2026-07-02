# no-only-test

📝 Disallow the `.only` test modifier.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

The `.only` modifier (or the `{only: true}` option) restricts the run to only the marked tests, which is useful while developing but a mistake to commit, since it silently skips the rest of the suite.

## Examples

```js
import test from 'node:test';

// ❌
test.only('foo', () => {});

// ❌
test('foo', {only: true}, () => {});

// ✅
test('foo', () => {});
```

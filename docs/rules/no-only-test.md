# no-only-test

📝 Disallow the `.only` test modifier.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

The `.only` modifier (or the `{only: true}` option) marks a test as the one to run, which is useful while developing but a mistake to commit. It only takes effect when the runner is started with the [`--test-only`](https://nodejs.org/api/test.html#--test-only) command-line option; a plain `node --test` run executes every test and prints a diagnostic saying that `only` needs the flag. Under `--test-only` the rest of the suite is skipped, so a committed marker is easy to miss.

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

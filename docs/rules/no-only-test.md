# no-only-test

📝 Disallow the `.only` test modifier.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

The `.only` modifier (or the `{only: true}` option) marks a test as the one to run, which is useful while developing but a mistake to commit. It takes effect when the runner is started with the [`--test-only`](https://nodejs.org/api/test.html#--test-only) command-line option, and in newer Node.js versions also when the file is run directly (`node foo.test.js`). Then the other tests do not run, so a committed marker is easy to miss. A plain `node --test` run executes every test and prints a diagnostic saying that `only` needs the flag.

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

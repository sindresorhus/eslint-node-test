# no-skip-test

📝 Disallow the `.skip` test modifier.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Skipped tests do not run and can silently rot. They are useful while developing but should generally not be committed.

## Examples

```js
import test from 'node:test';

// ❌
test.skip('foo', () => {});

// ❌
test('foo', {skip: true}, () => {});

// ✅
test('foo', () => {});
```

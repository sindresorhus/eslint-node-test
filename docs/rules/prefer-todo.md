# prefer-todo

📝 Prefer `.todo` for empty placeholder tests.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A test with no implementation — either `test('title')` with no function, or `test('title', () => {})` with an empty body — passes silently, so it looks like real coverage while testing nothing. Marking it with `.todo` instead makes the intent explicit: the runner reports it as a pending TODO rather than a passing test.

This rule reports empty placeholder tests and offers a suggestion to convert them to `.todo`. Tests with an existing modifier (`.only`/`.skip`/`.todo`) or an options object are left alone, since those are intentional.

## Examples

```js
import test from 'node:test';

// ❌
test('title');

// ❌
test('title', () => {});

// ✅
test.todo('title');
```

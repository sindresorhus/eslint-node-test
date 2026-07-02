# no-todo-test

📝 Disallow the `.todo` test modifier.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`.todo` tests mark planned but unwritten tests. They are handy locally but are easy to forget and leave incomplete once committed.

## Examples

```js
import test from 'node:test';

// ❌
test.todo('foo');

// ❌
test('foo', {todo: true}, () => {});

// ✅
test('foo', () => {
	// …
});
```

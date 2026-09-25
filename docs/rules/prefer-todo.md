# prefer-todo

📝 Prefer `.todo` for empty placeholder tests.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A test with no implementation — either `test('title')` with no function, or `test('title', () => {})` with an empty body — passes silently, so it looks like real coverage while testing nothing. Marking it with `.todo` instead makes the intent explicit: the runner reports it as a pending TODO rather than a passing test.

A subtest has no `.todo` method, and `t.todo(…)` is the enclosing test's TODO marker rather than a subtest registrar, so an empty subtest is marked with the `todo` option on its own call: `t.test('title', {todo: true})`.

This rule reports empty placeholder tests and offers a suggestion to convert them to `.todo`, or to the `todo` option for a subtest, since `t.test` has no `.todo` method. Tests with an existing modifier (`.only`/`.skip`/`.todo`) are left alone. An options object is left alone when it carries intent: `{skip: true}` and friends, but a descriptor that only holds `name` or `fn` is still reported, because neither says the test is deliberate.

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

```js
import test from 'node:test';

// ❌
test('parent', async t => {
	await t.test('title', () => {});
});

// ✅
test('parent', async t => {
	await t.test('title', {todo: true});
});
```

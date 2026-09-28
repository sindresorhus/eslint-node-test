# prefer-todo

📝 Prefer `.todo` for empty placeholder tests.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A test with no implementation — either `test('title')` with no function, or `test('title', () => {})` with an empty body — passes silently, so it looks like real coverage while testing nothing. Marking it with `.todo` instead makes the intent explicit: the runner reports it as a pending TODO rather than a passing test.

A subtest has no `.todo` method, and `t.todo(…)` is the enclosing test's TODO marker rather than a subtest registrar, so an empty subtest is marked with the `todo` option on its own call: `t.test('title', {todo: true})`. A subtest that already passes an options object or a descriptor is reported without a suggestion, since the option would land in the callback slot. Any test whose callback is followed by another argument, or is an `fn` in the options object, is reported without a suggestion too: the argument after it would move into the callback slot and run as the body, and an `fn` is no argument the suggestion can drop.

This rule reports empty placeholder tests and offers a suggestion to convert them to `.todo`, or to the `todo` option for a subtest, since `t.test` has no `.todo` method. Tests with an existing modifier (`.only`/`.skip`/`.todo`) are left alone. An options object is left alone when it carries intent: `{skip: true}` and friends, while a descriptor that only holds `name` or `fn` does not, so a test that pairs one with an empty body is still reported. A test that passes such an options object after its title but no function (`test('title', {name: 'other'})`), and a test with no title, are left alone. A descriptor with no `fn` (`test({name: 'title'})`) is reported, since it is the same placeholder as `test('title')`.

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

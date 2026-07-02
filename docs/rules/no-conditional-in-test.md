# no-conditional-in-test

📝 Disallow conditional logic inside tests.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A test should exercise one specific scenario and behave the same way on every run. Conditional logic (`if`, `switch`, or a ternary) inside a test body means different code runs depending on the environment or input, which makes failures harder to reproduce and can hide assertions that never execute. Usually the branches should be separate tests, or the value should be computed before the test.

This rule reports `if`/`switch` statements and ternary expressions inside a test or hook body. Conditionals inside a `describe` body are about _registering_ tests and are covered by [`no-conditional-tests`](./no-conditional-tests.md) instead.

This is a broad, opinionated rule, so it is off by default. For the narrower case of an assertion that may never run, see [`no-conditional-assertion`](./no-conditional-assertion.md).

## Examples

```js
import test from 'node:test';

// ❌
test('title', () => {
	if (condition) {
		assert.ok(value);
	}
});

// ✅
test('title with condition', () => {
	assert.ok(value);
});

// ✅
test('title without condition', () => {
	assert.ok(other);
});
```

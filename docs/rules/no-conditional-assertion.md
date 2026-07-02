# no-conditional-assertion

📝 Disallow assertions inside conditional code within a test.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Assertions placed inside conditional blocks (`if`/`else`, `switch`, ternary, logical `&&`/`||`/`??`, loops) may never execute, which undermines the guarantee that a test actually verifies anything. Move assertions outside the conditional, or restructure the test so each path is covered by its own unconditional assertion.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert';

// ❌ — assertion may not run if x is falsy
test('foo', () => {
	if (x) {
		assert.ok(value);
	}
});

// ❌ — right-hand side of && is conditional
test('foo', () => {
	ready && assert.ok(value);
});

// ❌ — assertion inside a loop may run 0 or many times
test('foo', () => {
	for (const item of items) {
		assert.ok(item);
	}
});

// ✅ — unconditional assertion
test('foo', () => {
	assert.strictEqual(result, expected);
});

// ✅ — assertion in the condition test itself always runs
test('foo', () => {
	if (assert.ok(value)) {
		setup();
	}
});
```

This rule is purely syntactic: it flags an assertion wrapped in a conditional anywhere between the assertion and the enclosing test or hook, including inside nested helper functions. So an assertion inside an `if` within a helper is reported even if that helper is always called.

This also applies to hooks, where a conditional assertion may silently never run:

```js
import {beforeEach} from 'node:test';
import assert from 'node:assert';

// ❌
beforeEach(() => {
	if (x) {
		assert.ok(value);
	}
});
```

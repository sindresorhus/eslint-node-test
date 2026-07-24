# no-constant-assertion

📝 Disallow assertions with constant outcomes.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Assertions should depend on the behavior under test. An assertion whose result is fully determined by constant values always passes or always fails before the test code can affect it. This usually means the wrong value was asserted, a fixture was left behind, or an assertion was being used as an unreachable marker.

Use `assert.fail()` for intentional unreachable code. This rule reports `assert(false)` and `assert.ok(false)` because their outcome is still constant.

This rule reports `ok`, bare `assert()`, `ifError`, equality assertions, and match assertions with a constant asserted value and regex literal pattern.

A value is constant when it consists entirely of literals and variables bound to a primitive. Anything read through an object, like an identifier bound to an array, a property access such as `object.property`, or a call such as `array.slice()`, is never treated as constant, even when its initializer is static, since the object can be mutated between its definition and the assertion.

For match assertions, this rule intentionally only evaluates regex literal patterns.

## Examples

```js
import assert from 'node:assert/strict';

// ❌
assert.ok(true);
assert(false);
assert.strictEqual(1, 1);
assert.match('hello', /ell/);

// ✅
assert.ok(result);
assert.strictEqual(actual, expected);
assert.fail('unreachable');
```

```js
import assert from 'node:assert/strict';
import test from 'node:test';

test('does not mutate the input', () => {
	const original = ['red', 'blue', 'green'];
	const copy = original.slice();

	doSomething(copy);

	// ✅ Both arrays are read through a reference, so the outcome depends on `doSomething`
	assert.deepEqual(copy, original);
});
```

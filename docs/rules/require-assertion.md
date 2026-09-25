# require-assertion

📝 Require that each test contains at least one assertion.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A test without any assertions passes whenever its body returns normally, so a wrong result that nothing checks goes unnoticed. A body that throws still fails, which is why this rule is about missing checks rather than about failures. This rule requires each `test`/`it` call to contain at least one assertion from `node:assert`, the test context's `assert` property, or the `assert` property directly destructured from the test callback parameter.

Note: Tests that reference an external implementation (without an inline function body) are not flagged, since the implementation may contain assertions. A skipped test is not flagged either, because its body never runs and so cannot pass vacuously; a `todo` test does run, so it is still checked.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert';

// ❌
test('foo', () => {
	doSomething();
});

// ❌
test('foo', () => {});

// ✅
test('foo', () => {
	assert.strictEqual(result, expected);
});

// ✅
test('foo', t => {
	t.assert.ok(value);
});

// ✅
test('foo', ({assert}) => {
	assert.ok(value);
});

// ✅ — external implementation, may contain assertions
test('foo', implementation);
```

# require-assertion

📝 Require that each test contains at least one assertion.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A test without any assertions will always pass, even if the code under test is broken. This rule requires each `test`/`it` call to contain at least one assertion from `node:assert`, `t.assert`, or `TestContext.assert` destructured from the callback parameter.

Note: Tests that reference an external implementation (without an inline function body) are not flagged, since the implementation may contain assertions.

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

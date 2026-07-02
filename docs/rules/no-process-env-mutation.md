# no-process-env-mutation

📝 Disallow mutating `process.env` inside tests.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Mutating `process.env` directly in a test or subtest callback leaks into later tests running in the same process. This makes tests order-dependent and hard to debug.

Use the test context's `mock.property()` for test-local environment overrides, or move shared environment setup into hooks that restore the original value.

This rule only targets persistent environment state. It does not report reads from `process.env`, console output, `process.stdout`, or other process APIs. Top-level hooks and nested callbacks are intentionally out of scope, so hooks can own paired setup and teardown without triggering this rule.

## Examples

```js
import test from 'node:test';

// ❌
test('reads config', () => {
	process.env.NODE_ENV = 'production';
});

// ❌
test('reads config', () => {
	delete process.env.NODE_ENV;
});

// ✅
test('reads config', t => {
	t.mock.property(process.env, 'NODE_ENV', 'production');
});

// ✅
test('reads config', () => {
	const nodeEnvironment = process.env.NODE_ENV;
});
```

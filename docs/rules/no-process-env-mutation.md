# no-process-env-mutation

📝 Disallow mutating `process.env` inside tests.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Mutating `process.env` directly in a test or subtest callback leaks into later tests running in the same process. This makes tests order-dependent and hard to debug.

Move environment setup into hooks that restore the original value.

This rule only targets persistent environment state. It does not report reads from `process.env`, console output, `process.stdout`, other process APIs, or mutating calls that target `process` itself, such as `Object.defineProperty(process, 'env', …)` or `Reflect.set(process, 'env', …)`. Top-level hooks and non-test callbacks nested inside tests are intentionally out of scope, so hooks can own paired setup and teardown without triggering this rule.

## Examples

```js
import test, {beforeEach, afterEach} from 'node:test';

// ❌
test('reads config', () => {
	process.env.NODE_ENV = 'production';
});

// ❌
test('reads config', () => {
	delete process.env.NODE_ENV;
});

// ✅
let previousNodeEnvironment;
beforeEach(() => {
	previousNodeEnvironment = process.env.NODE_ENV;
	process.env.NODE_ENV = 'production';
});
afterEach(() => {
	if (previousNodeEnvironment === undefined) {
		delete process.env.NODE_ENV;
	} else {
		process.env.NODE_ENV = previousNodeEnvironment;
	}
});

// ✅
test('reads config', () => {
	const nodeEnvironment = process.env.NODE_ENV;
});
```

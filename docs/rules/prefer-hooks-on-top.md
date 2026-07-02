# prefer-hooks-on-top

📝 Require hooks to be declared before the tests in their scope.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Hooks (`before`, `after`, `beforeEach`, `afterEach`) apply to every test in their scope regardless of where they are written. Placing a hook after a test reads as if it only affects later tests, which is misleading. Keeping all hooks at the top of their scope makes the setup and teardown easy to find and the execution order obvious.

This rule reports a hook declared after a test, `it`, or nested `describe` in the same scope.

## Examples

```js
import {describe, it, beforeEach} from 'node:test';

// ❌
describe('user', () => {
	it('is created', () => {});

	beforeEach(() => {
		reset();
	});
});

// ✅
describe('user', () => {
	beforeEach(() => {
		reset();
	});

	it('is created', () => {});
});
```

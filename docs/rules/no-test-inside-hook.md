# no-test-inside-hook

📝 Disallow defining tests and suites inside a hook.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Tests and suites must be defined while the file is being loaded, not while a hook runs. Defining a `test`, `it`, `describe`, or `suite` inside a `before`/`after`/`beforeEach`/`afterEach` callback registers it after the surrounding test has already started, which the runner rejects with an error such as *"hook generated asynchronous activity after the test ended"*. Move the definition to the top level or into the enclosing `describe`. To create dynamic subtests, use the test context's `t.test()` inside a test body.

This is the hook counterpart of [`no-nested-tests`](./no-nested-tests.md).

## Examples

```js
import {describe, it, beforeEach} from 'node:test';

// ❌
describe('suite', () => {
	beforeEach(() => {
		it('registered too late', () => {});
	});
});

// ✅
describe('suite', () => {
	it('defined at suite build time', () => {});

	beforeEach(() => {
		setup();
	});
});
```

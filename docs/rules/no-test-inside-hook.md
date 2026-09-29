# no-test-inside-hook

📝 Disallow defining tests and suites inside a hook.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Tests and suites must be defined while the file is being loaded, not while a hook runs. Defining a `test`, `it`, `describe`, or `suite` inside a `before`/`after`/`beforeEach`/`afterEach` callback registers it after the runner has already built that suite's children, so it belongs to no test: its body still runs, but late, and the definition never appears in the report. From a `beforeEach` or `afterEach` that late run is also reported as asynchronous activity after the test ended, which fails the run. Move the definition to the top level or into the enclosing `describe`. To create dynamic subtests, use the test context's `t.test()` inside a test body. A `t.test()` call in a `beforeEach` or `afterEach` hook does run, as a subtest of each test the hook runs for, but it is reported too, since the subtest belongs in the test body.

This is the hook counterpart of [`no-nested-tests`](./no-nested-tests.md). A test defined in the body of a test that a hook registers belongs to that test rather than to the hook, so it is left to `no-nested-tests`.

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

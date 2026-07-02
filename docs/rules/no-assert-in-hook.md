# no-assert-in-hook

📝 Disallow assertions inside hooks.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Hooks (`before`, `after`, `beforeEach`, `afterEach`) are for setup and teardown, not verification. When an assertion fails inside a hook, the runner reports it as a hook failure attributed to every test the hook applies to, rather than as a single focused test failure, which makes the cause harder to locate. Put assertions inside the tests that depend on them.

This is the hook counterpart of [`no-assert-in-describe`](./no-assert-in-describe.md).

This rule is off by default, since asserting a precondition in a hook to fail fast is a defensible pattern. Enable it if you prefer all assertions to live in tests.

## Examples

```js
import {beforeEach, it} from 'node:test';
import assert from 'node:assert';

// ❌
beforeEach(() => {
	assert.ok(database.isConnected);
});

// ✅
it('reads a record', () => {
	assert.ok(database.isConnected);
	// …
});
```

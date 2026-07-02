# no-process-exit-in-test

📝 Disallow process exit control in test files.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Tests should fail through thrown errors or assertions, not by controlling the Node.js process. `process.exit()` stops the test runner immediately, so the current test and later tests may not report normally. Setting `process.exitCode` is also confusing in tests: the suite can finish with passing tests in the report while the process exits non-zero.

This rule reports direct `process.exit()` calls and direct writes to `process.exitCode` in files that import `node:test` or `test`. It intentionally does not chase aliases, destructuring, computed properties, or account for shadowed `process` bindings.

This overlaps with [`n/no-process-exit`](https://github.com/eslint-community/eslint-plugin-n/blob/master/docs/rules/no-process-exit.md) and [`unicorn/no-process-exit`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-process-exit.md), which cover `process.exit()` globally. This rule is narrower and also covers `process.exitCode` in Node.js test files.

If you need to test CLI exit behavior, run the CLI in a child process and assert on that child process's exit status.

## Examples

```js
import test from 'node:test';
import assert from 'node:assert/strict';

// ❌
test('validates', () => {
	if (!ok) {
		process.exitCode = 1;
	}
});

// ❌
test('shuts down', () => {
	process.exit(0);
});

// ✅
test('validates', () => {
	assert.ok(ok);
});
```

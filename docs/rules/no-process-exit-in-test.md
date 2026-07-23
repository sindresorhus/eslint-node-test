# no-process-exit-in-test

📝 Disallow process exit control in test files.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Tests should fail through thrown errors or assertions, not by controlling the Node.js process. `process.exit()` stops the runner immediately, while `process.exitCode` can make the suite exit non-zero even when all reported tests pass.

This rule reports direct `process.exit()` calls and direct writes to `process.exitCode` in files that import `node:test`. It intentionally ignores aliases, destructuring, and computed properties. Shadowed `process` bindings are unsupported and may still be reported.

This overlaps with [`n/no-process-exit`](https://github.com/eslint-community/eslint-plugin-n/blob/master/docs/rules/no-process-exit.md) and [`unicorn/no-process-exit`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-process-exit.md), but is test-scoped and also covers `process.exitCode`. To test CLI exits, run the CLI in a child process and assert on the child's exit status.

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

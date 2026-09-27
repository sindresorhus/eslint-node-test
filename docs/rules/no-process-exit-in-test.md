# no-process-exit-in-test

📝 Disallow process exit control in test files.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Tests should fail through thrown errors or assertions, not by controlling the Node.js process. `process.exit()` ends the run at once: every test that has not started yet is dropped, and the file is still reported as passing with exit status 0, so a committed `process.exit(0)` makes a whole file look green. `process.exitCode = 1` leaves the reported tests passing but makes the runner report the file as failed and exit non-zero.

This rule reports direct `process.exit()` calls and direct writes to `process.exitCode` in files that import `node:test`, including the same calls reached through `globalThis.process` or `global.process`, and a call to a name the file imported as the `exit` export of `node:process`. It intentionally ignores aliases, destructuring, and computed properties. Shadowed `process` bindings are unsupported and may still be reported. A shadowed `globalThis` or `global` is resolved, so `globalThis.process.exit()` through a local binding of that name is not reported.

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

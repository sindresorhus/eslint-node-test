# no-process-chdir-in-test

📝 Disallow changing the working directory inside tests.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

[`process.chdir()`](https://nodejs.org/api/process.html#processchdirdirectory) changes the working directory for the whole Node.js process. Tests in the same file run in one app thread, so calling it in a test can affect later tests. See the [test runner execution model](https://nodejs.org/api/test.html#test-runner-execution-model).

Prefer absolute paths. If changing the working directory is unavoidable, use setup and restoration hooks only when tests run serially. Hooks are unsafe with concurrent tests, even when they restore the directory.

This rule reports direct calls in `test`/`it` and `t.test()` callbacks, including imports from `node:process` or `process`. It ignores hooks, suite bodies, top-level setup, nested helpers, computed properties, CommonJS imports, aliases, and indirect calls.

## Examples

```js
import test from 'node:test';
import path from 'node:path';

// ❌
test('loads the fixture', () => {
	process.chdir('fixtures');
});

// ✅
test('loads the fixture', () => {
	const fixturePath = path.resolve(import.meta.dirname, 'fixtures', 'example.json');
	loadFixture(fixturePath);
});
```

# no-process-chdir-in-test

📝 Disallow changing the working directory inside tests.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

[`process.chdir()`](https://nodejs.org/api/process.html#processchdirdirectory) changes the working directory for the whole Node.js process. Tests declared in the same file run in one application thread, so calling it directly in a test or subtest can leave later tests running from the wrong directory, making them order-dependent and difficult to debug. See the [test runner execution model](https://nodejs.org/api/test.html#test-runner-execution-model).

Use absolute paths where possible. When a suite must change the working directory, own the setup and restoration in hooks. This is unsafe with concurrent tests, even when restored afterward. This rule reports direct calls in `test`/`it` and `t.test()` callbacks, including supported imports from `node:process` or `process`. It intentionally ignores hooks, suite bodies, top-level setup, nested helper functions, computed properties, CommonJS imports, extracted aliases, and indirect invocations.

## Examples

```js
import test, {afterEach, beforeEach} from 'node:test';
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

// ✅
let originalWorkingDirectory;
beforeEach(() => {
	originalWorkingDirectory = process.cwd();
	process.chdir('fixtures');
});
afterEach(() => {
	process.chdir(originalWorkingDirectory);
});
```

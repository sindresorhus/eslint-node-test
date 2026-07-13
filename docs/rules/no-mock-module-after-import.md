# no-mock-module-after-import

📝 Disallow mocking a module after statically importing it.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`mock.module()` does not change [references that were imported before the mock was created](https://nodejs.org/api/test.html#mockmodulespecifier-options). Static ESM imports are evaluated before any code in the test file runs, so a matching static import in the same file keeps pointing at the original module.

This rule reports `mock.module()` when the module is already imported statically in the same file, including calls through `t.mock` and `getTestContext().mock`. Specifiers are compared exactly, without resolving paths or normalizing `node:` prefixes. Use a dynamic `import()` after creating the mock instead.

## Examples

```js
import test from 'node:test';
import {readFile} from 'node:fs';

test('reads a file', t => {
	// ❌ `readFile` still references the original module.
	t.mock.module('node:fs', {exports: {readFile: () => 'mocked'}});
});
```

```js
import test from 'node:test';

test('reads a file', async t => {
	t.mock.module('node:fs', {exports: {readFile: () => 'mocked'}});
	const {readFile} = await import('node:fs');
	// ✅ `readFile` is mocked.
});
```

Only ESM static imports are checked. CommonJS `require()` calls and dynamic imports are intentionally ignored.

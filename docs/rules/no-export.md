# no-export

📝 Disallow exports from test files.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A test file is run by the test runner for its side effects (registering and running tests); it is not a module meant to be imported elsewhere. Exporting from it is almost always a mistake — for example, leaving an `export` on a helper that should live in a separate file, or accidentally exporting test internals.

This rule reports `export` declarations (including re-exports and default exports) in a file that imports `node:test`.

## Examples

```js
import test from 'node:test';

// ❌
export function helper() {}

// ✅
test('title', () => {});
```

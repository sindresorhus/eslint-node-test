# no-import-test-files

📝 Disallow imports of Node.js test files.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Node.js discovers test files by their path and executes each one. Importing one of those files can execute it a second time, registering duplicate tests or repeating its side effects.

This rule resolves relative static imports, re-exports, and literal dynamic imports from the importing file, then reports targets that match Node.js-style test file name patterns. It only checks files that import from `node:test`, so a test file for another test runner, like AVA, can import a helper such as `test/_helper.js`. CommonJS `require(…)` calls are not checked. It ignores package specifiers, absolute paths, `file:` URLs, computed dynamic imports, and declaration-level type-only TypeScript imports and exports (`import type {X} from '…'`) because they are erased and do not load the target module. A specifier-level type import (`import {type X} from '…'`) is still reported: Node.js type stripping keeps it as `import {} from '…'`, which loads the module.

Name matching follows the file system: on a case-insensitive one (macOS, Windows) `./TEST/Example.Test.js` resolves to the same file as `./test/example.test.js`, so it is matched too. On a case-sensitive file system only the exact lowercase spelling matches.

The rule recognizes JavaScript (`.js`, `.mjs`, `.cjs`), JSX (`.jsx`), and TypeScript (`.ts`, `.mts`, `.cts`, `.tsx`) test files. JSX and TSX are included for test runners configured to run them. JSX and TypeScript test-file imports may be reported even when the project's Node.js version or test-runner configuration does not discover them, since the rule cannot determine how tests are run.

## Examples

```js
// The rule only checks files that import from `node:test`
import test from 'node:test';

// ❌
import './example.test.js';
await import('./test/helpers.js');
export * from './test-example.mjs';

// ✅
import './example.js';
import './test/helpers.json';
await import(`./${name}.test.js`);
```

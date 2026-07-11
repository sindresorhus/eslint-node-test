# no-import-test-files

📝 Disallow imports of Node.js test files.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Node.js discovers test files by their path and executes each one. Importing one of those files can execute it a second time, registering duplicate tests or repeating its side effects.

This rule resolves relative static imports, re-exports, and literal dynamic imports from the importing file, then reports targets that match Node.js-style test file name patterns. It ignores package specifiers, absolute paths, `file:` URLs, computed dynamic imports, and type-only TypeScript imports because they are erased and do not load the target module.

The rule recognizes JavaScript (`.js`, `.mjs`, `.cjs`), JSX (`.jsx`), and TypeScript (`.ts`, `.mts`, `.cts`, `.tsx`) test files. JSX and TSX are included for runners configured with a loader or transform. JSX and TypeScript test-file imports may be reported even when the project's Node.js version or test-runner configuration does not discover them, since the rule cannot determine how tests are run.

## Examples

```js
// ❌
import './example.test.js';
await import('./test/helpers.js');
export * from './test-example.mjs';

// ✅
import './example.js';
import './test/helpers.json';
await import(`./${name}.test.js`);
```

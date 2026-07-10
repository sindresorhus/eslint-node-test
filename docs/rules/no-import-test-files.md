# no-import-test-files

📝 Disallow imports of Node.js test files.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Node.js discovers test files by their path and executes each one. Importing one of those files can execute it a second time, registering duplicate tests or repeating its side effects.

This rule reports relative static imports, re-exports, and literal dynamic imports that match Node.js's default test file discovery patterns. It ignores package specifiers, absolute paths, `file:` URLs, computed dynamic imports, and type-only TypeScript imports because they are erased and do not load the target module.

## Options

### `extensions`

Type: `string[]`\
Default: `['js', 'mjs', 'cjs']`

File extensions that Node.js is configured to discover. Add `ts`, `mts`, and `cts` when running Node with TypeScript type stripping enabled.

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

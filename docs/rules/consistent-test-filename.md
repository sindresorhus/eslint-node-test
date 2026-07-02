# consistent-test-filename

📝 Enforce a consistent test file name pattern.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`node:test` discovers test files by several name patterns (`*.test.js`, `*-test.js`, `test.js`, files under `test/`). Picking one convention and applying it consistently makes test files easy to spot and keeps discovery predictable.

This rule reports a file that imports `node:test` but whose name does not match the configured pattern. It only checks files that import `node:test`, so non-test files are never flagged.

## Options

### `pattern`

Type: `string`\
Default: `'\\.test\\.[cm]?[jt]sx?$'`

A regular expression the test file name must match. The default requires a `.test.` segment, for example `foo.test.js` or `foo.test.ts`.

## Examples

With the default pattern:

```text
// ❌
foo.js
foo.spec.js

// ✅
foo.test.js
foo.test.ts
```

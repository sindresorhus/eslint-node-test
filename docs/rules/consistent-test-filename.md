# consistent-test-filename

📝 Enforce a consistent test file name pattern.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`node:test` discovers test files by several name patterns — for a JavaScript file `*.test.js`, `*-test.js`, `*_test.js`, `test.js`, `test-*.js`, and anything under a `test/` directory, with `.mjs`/`.cjs` and the `.ts`/`.mts`/`.cts` equivalents. Picking one convention and applying it consistently makes test files easy to spot and keeps discovery predictable.

This rule reports a file that imports `node:test` but whose name does not match the configured pattern. It only checks files that import `node:test`, so non-test files are never flagged.

## Options

### `pattern`

Type: `string`\
Default: `'\\.test\\.[cm]?[jt]sx?$'`

A regular expression the test file name must match. The default requires a `.test.` segment, for example `foo.test.js` or `foo.test.ts`. It is compiled with the [`v` flag](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/unicodeSets), so `\p{…}` property escapes and set operations work. The pattern must be valid with that flag, which reserves more syntax characters inside a character class than the `u` flag does: a literal `-`, `(`, `)`, `[`, `{`, `}`, `/` or `|` there must be escaped, and so must a doubled punctuator such as `!!`.

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

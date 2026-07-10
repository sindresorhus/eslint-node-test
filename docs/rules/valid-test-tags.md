# valid-test-tags

📝 Require valid test tags.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`node:test` tags annotate tests and suites with cross-cutting metadata such as a subsystem or speed bucket. Invalid tags throw while registering the test, and Node normalizes valid tags to lowercase while collapsing duplicates.

This rule checks static tag arrays. It requires each tag to be a nonempty string in lowercase canonical form and reports case-insensitive duplicates. Dynamic tag values, spread elements, and tag properties that a later spread or computed key may override are skipped because their runtime values cannot be determined statically.

## Examples

```js
import {describe, test} from 'node:test';

// ❌
test('loads the database', {tags: 'database'}, () => {});
test('retries the request', {tags: ['Slow', 'slow']}, () => {});

// ✅
describe('database', {tags: ['database']}, () => {
	test('loads a record', {tags: ['slow']}, () => {});
});
```

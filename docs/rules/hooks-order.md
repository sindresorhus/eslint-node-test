# hooks-order

📝 Enforce a consistent order of hook declarations.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Enforce a consistent declaration order for `node:test` hooks. The canonical order is: `before`, `beforeEach`, `afterEach`, `after`.

A hook whose statement is continued by the code below it is not seen. In semicolon-free code where the next line starts with `(` or `[`, the two parse as one expression, so the hook call is no longer a statement of its own. Write the semicolon, or put the two on separate statements.

The fix moves only each hook's call expression into another hook's place. Each statement keeps its own semicolon, or its lack of one, so the fix works the same in code with and without semicolons. The hooks are reported without a fix when other code or a comment sits between them, or a comment sits next to the first or last hook.

## Examples

```js
import {describe, before, beforeEach, afterEach, after} from 'node:test';

// ❌
describe('user', () => {
	afterEach(() => {});
	before(() => {});
});

// ✅
describe('user', () => {
	before(() => {});
	beforeEach(() => {});
	afterEach(() => {});
	after(() => {});
});
```

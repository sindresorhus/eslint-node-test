# hooks-order

📝 Enforce a consistent order of hook declarations.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Enforce a consistent declaration order for `node:test` hooks. The canonical order is: `before`, `beforeEach`, `afterEach`, `after`.

## Examples

```js
import {before, beforeEach, afterEach, after} from 'node:test';

// ❌
afterEach(() => {});
before(() => {});

// ✅
before(() => {});
beforeEach(() => {});
afterEach(() => {});
after(() => {});
```

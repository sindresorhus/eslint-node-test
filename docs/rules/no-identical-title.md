# no-identical-title

📝 Disallow identical test titles within the same scope.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Disallow test/suite calls with the same title within the same scope. Duplicate titles make test output confusing and harder to diagnose.

Titles are compared per scope: the same title is allowed in different `describe`/`suite` blocks, but not within the same one. Only statically known string titles are checked; dynamic template literals are ignored.

## Examples

```js
import test, {describe} from 'node:test';

// ❌ Duplicate at the top level
test('foo', () => {});
test('foo', () => {});

// ❌ Duplicate inside a describe block
describe('suite', () => {
	test('bar', () => {});
	test('bar', () => {});
});

// ✅ Same title in different scopes is fine
describe('a', () => {
	test('shared name', () => {});
});

describe('b', () => {
	test('shared name', () => {});
});
```

# no-commented-tests

📝 Disallow commented-out tests.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Commented-out tests are dead code that can silently accumulate. Use `.skip()` to temporarily disable tests so they remain visible and tracked by the runner. Commented-out hooks (`before`, `after`, `beforeEach`, `afterEach`) are flagged too — remove them since hooks have no `.skip()`.

## Examples

```js
import test from 'node:test';

// ❌
// test('foo', () => {});

// ❌
// describe('group', () => {});

// ❌
// beforeEach(() => {});

// ✅
test.skip('foo', () => {});

// ✅
test('foo', () => {});
```

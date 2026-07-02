# no-nested-tests

📝 Disallow tests and suites nested inside a test body.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Defining a test or suite inside a test body does not register a proper subtest. Use the test context's `t.test()` for subtests, and group tests with `describe()` instead.

Grouping tests inside a `describe()`/`suite()`, and nesting suites, is fine — this rule only flags tests and suites declared inside a `test()`/`it()` body.

## Examples

```js
import test, {describe, it} from 'node:test';

// ❌
test('outer', () => {
	test('inner', () => {});
});

// ❌
test('outer', () => {
	describe('inner', () => {});
});

// ✅ Use a subtest
test('outer', async t => {
	await t.test('inner', () => {});
});

// ✅ Suites group tests and nested suites
describe('group', () => {
	it('a', () => {});

	describe('nested', () => {
		it('b', () => {});
	});
});
```

# no-nested-tests

📝 Disallow tests and suites nested inside a test body.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A test or suite declared inside a `test()`/`it()` body is adopted by the runner as a nested subtest of that test, which ties its lifetime and its reporting to the parent. Use the test context's `t.test()` for subtests, which states that relationship in the code, and group tests with `describe()` instead of nesting a test inside a test.

Grouping tests inside a `describe()`/`suite()`, and nesting suites, is fine — this rule only flags tests and suites that end up in a test body, whether that body is inline or a callback the call names out of line. `test('a', body)` and `t.test('sub', body)` are both followed into `body`, wherever it is declared.

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

# no-parent-test-context

📝 Disallow references to parent test contexts inside subtests.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

💡 This rule is manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Each `t.test()` callback receives its own test context. Referencing the parent context inside the child callback attaches lifecycle-scoped work to the wrong test: mocks restore with the parent, `plan()` counts on the parent, `t.assert` assertions are tied to the parent, and nested subtests are created under the parent.

This rule reports references to an outer test context binding from inside an inline subtest callback. Use the child callback's own context parameter instead. Only inline test/subtest callback chains are analyzed; non-inline callbacks such as `test('parent', helper)` or `t.test('child', helper)` are not analyzed.

## Examples

```js
import test from 'node:test';

// ❌
test('parent', async t => {
	await t.test('child', () => {
		t.mock.method(fs, 'readFileSync', () => '{}');
	});
});

// ✅
test('parent', async t => {
	await t.test('child', t2 => {
		t2.mock.method(fs, 'readFileSync', () => '{}');
	});
});
```

# test-title

📝 Require tests to have a title.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Tests must have a descriptive string title. A missing title makes test output harder to read and diagnose.

The title must be a non-empty string without leading or trailing whitespace. Leading/trailing whitespace is auto-fixable when the title is written as a string. A title read from a constant or an expression (`test(title, …)`) is reported without a fix, since rewriting it as a string literal would cut it off from the value it names.

## Examples

```js
import test from 'node:test';

// ❌ Missing title
test(() => {});

// ❌ Non-string title
test(123, () => {});

// ❌ Empty title
test('', () => {});

// ❌ Leading/trailing whitespace (auto-fixable)
test(' my test ', () => {});

// ✅
test('my test', () => {});
test('another test', async t => {
	await t.test('nested', () => {});
});
```

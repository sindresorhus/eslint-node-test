# no-test-return-statement

📝 Disallow returning a non-Promise value from a test.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`node:test` awaits a Promise returned from a test to know when an asynchronous test finishes, but it ignores any other return value. So `return 42` or `return someObject` in a test is dead code — usually a sign that an assertion or an `await` was intended instead.

This rule is **type-aware**: it uses TypeScript type information to tell a returned Promise from a plain value, so it only flags genuinely non-Promise returns and never the idiomatic `return doAsyncWork()`. It does nothing when type information is unavailable (plain JavaScript, or TypeScript linted without a [type-checked configuration](https://typescript-eslint.io/getting-started/typed-linting/)), so it never produces false positives there. Only return statements belonging to the test callback itself are checked; returns inside nested helper functions are ignored.

## Examples

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

// ❌
test('title', () => {
	return computeValue();
});

// ✅ — assert instead of returning
test('title', () => {
	assert.equal(computeValue(), expected);
});

// ✅ — returning a Promise is how you signal async completion
test('title', () => doAsyncWork());
```

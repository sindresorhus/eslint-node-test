# no-useless-assertion

📝 Disallow `assert.doesNotThrow()` and `assert.doesNotReject()`.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`assert.doesNotThrow()` and `assert.doesNotReject()` catch an error only to rethrow it, so they add nothing over just running the code. The [Node.js docs](https://nodejs.org/api/assert.html#assertdoesnotthrowfn-error-message) say so directly: "Using `assert.doesNotThrow()` is actually not useful because there is no benefit in catching an error and then rethrowing it." If the code under test throws, the test fails either way — but calling it directly gives a clearer stack trace.

This rule reports `assert.doesNotThrow()` and `assert.doesNotReject()`. Call the code directly, and add a comment if it helps explain why it must not throw.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.doesNotThrow(() => parse(input));
await assert.doesNotReject(() => load(url));

// ✅
parse(input);
await load(url);
```

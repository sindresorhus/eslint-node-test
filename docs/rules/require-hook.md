# require-hook

📝 Require setup and teardown code to be inside a hook.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Code placed directly at the top level of a test file or inside a `describe` body runs when the file is _loaded_ (while tests are being collected), not as part of any test. Setup written there runs once, in collection order, before any test or hook — a common source of surprising, order-dependent failures. Putting setup and teardown in a `before`/`beforeEach`/`after`/`afterEach` hook makes the timing explicit and lets the runner manage it per test or per suite.

This rule reports bare function calls at the module top level or directly inside a `describe`/`suite` body. The test, suite, and hook registration calls themselves are allowed, as are assertions (reported by [`no-assert-in-describe`](./no-assert-in-describe.md)) and variable declarations. Use the `allow` option to permit specific calls.

## Options

### `allow`

Type: `string[]`\
Default: `[]`

A list of callee expressions to allow at the top level, for example `['console.log']`.

## Examples

```js
import test, {beforeEach} from 'node:test';

// ❌
startServer();

test('title', () => {});

// ✅
beforeEach(() => {
	startServer();
});

test('title', () => {});
```

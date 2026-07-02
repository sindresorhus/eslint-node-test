# valid-describe-callback

📝 Enforce valid `describe` callbacks.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`node:test` calls a `describe`/`suite` callback with no arguments and ignores its return value. A parameter on the callback is usually a mistake, confusing it with a `test`/`it` callback, which _does_ receive the test context. An implicit return from an arrow callback registers tests through a returned expression instead of statements in a block body, which is harder to read.

This rule reports a `describe`/`suite` callback that declares a parameter or has an arrow expression body. A top-level `return` inside a block body is not reported.

See also [`no-async-describe`](./no-async-describe.md), which covers `async` callbacks.

## Examples

```js
import {describe, test} from 'node:test';

// ❌
describe('user', t => {
	test('has a name', () => {});
});

// ❌
describe('user', () => test('has a name', () => {}));

// ✅
describe('user', () => {
	test('has a name', () => {});
});
```

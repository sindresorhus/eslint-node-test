# valid-describe-callback

📝 Enforce valid `describe` callbacks.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`node:test` calls a `describe`/`suite` callback with a `SuiteContext` and ignores its return value. A parameter is therefore a real use, not a mistake: the suite context carries the suite `name`, `fullName`, `signal`, `passed`, `attempt`, `diagnostic()`, and `log()`. It does not have the `before`/`after`/`beforeEach`/`afterEach` methods a test context has, so a suite callback that needs a hook declares it with the imported `beforeEach` and friends. An implicit return from an arrow callback registers tests through a returned expression instead of statements in a block body, which is harder to read.

This rule reports a `describe`/`suite` callback whose arrow has an expression body. A top-level `return` inside a block body is not reported.

See also [`no-async-describe`](./no-async-describe.md), which covers `async` callbacks.

## Examples

```js
import {describe, test} from 'node:test';

// ❌
describe('user', () => test('has a name', () => {}));

// ✅
describe('user', () => {
	test('has a name', () => {});
});

// ✅ — the suite context is a documented argument
describe('user', t => {
	t.diagnostic('loading the user');
	test('has a name', () => {});
});
```

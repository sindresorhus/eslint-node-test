# no-assert-in-describe

📝 Disallow assertions directly inside a `describe` body.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

A `describe`/`suite` callback runs once, while the runner is _building_ the suite — synchronously for a normal callback, and after each `await` for an `async` one (see [`no-async-describe`](./no-async-describe.md)) — not when its tests run. An assertion placed directly in that body therefore executes at collection time: it runs once regardless of which tests are selected, and if it throws the suite fails and its own children never run, while sibling tests still report. Assertions belong inside a `test`/`it` or a hook.

This rule reports an assertion whose nearest enclosing function is a `describe`/`suite` callback. Assertions inside a test, a hook, or a helper function are not reported.

## Examples

```js
import {describe, it} from 'node:test';
import assert from 'node:assert';

// ❌
describe('user', () => {
	assert.ok(user); // runs when the suite is built

	it('has a name', () => {});
});

// ✅
describe('user', () => {
	it('exists', () => {
		assert.ok(user);
	});
});
```

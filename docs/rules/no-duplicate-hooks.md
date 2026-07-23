# no-duplicate-hooks

📝 Disallow duplicate hooks within the same scope.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Declaring the same hook (`before`, `after`, `beforeEach`, or `afterEach`) more than once in a single scope is almost always an accident, typically from copy-paste. Both hooks run, so the duplicate silently doubles up setup or teardown and makes the test harder to follow. Consolidate the logic into a single hook instead.

This rule reports a hook whose name was already used in the same scope. Hooks in different scopes (a nested `describe`, or sibling suites) are independent and not reported.

## Examples

```js
import {describe, beforeEach} from 'node:test';

// ❌
describe('user', () => {
	beforeEach(() => {
		setupA();
	});
	beforeEach(() => {
		setupB();
	});
});

// ✅
describe('user', () => {
	beforeEach(() => {
		setupA();
		setupB();
	});
});

// ✅ (same hook name in different scopes)
describe('outer', () => {
	beforeEach(() => {
		setupOuter();
	});

	describe('group', () => {
		beforeEach(() => {
			setupInner();
		});
	});
});
```

# max-nested-describe

📝 Enforce a maximum depth for nested `describe` blocks.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Deeply nested `describe` blocks make a test file hard to read: the setup for a test is spread across many enclosing scopes, and the indentation alone obscures what is being tested. A deep nest usually means the suite is trying to do too much and should be split into separate files.

This rule reports `describe`/`suite` blocks nested beyond a configurable depth (default 5).

## Options

```js
{
	'node-test/max-nested-describe': [
		'error',
		{
			max: 5 // maximum nesting depth (default: 5)
		}
	]
}
```

## Examples

```js
/* eslint
	node-test/max-nested-describe: [
		'error',
		{
			max: 2
		}
	]
*/
import {describe, it} from 'node:test';

// ❌
describe('a', () => {
	describe('b', () => {
		describe('c', () => {
			it('is too deep', () => {});
		});
	});
});

// ✅
describe('a', () => {
	describe('b', () => {
		it('is fine', () => {});
	});
});
```

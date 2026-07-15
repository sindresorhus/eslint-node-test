# test-title-format

📝 Require test titles to match a configured pattern.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Enforce a consistent naming convention for test and suite titles by requiring them to match a configurable regular expression pattern. Hook calls have no title and are not checked.

This rule is opt-in. Configure it when your project has a naming convention such as `'Should …'` or `'it …'`.

## Options

### `format`

Type: `string`

A regular expression pattern string that all test titles must match.

## Examples

```js
/* eslint
	node-test/test-title-format: [
		'error',
		{
			format: '^Should'
		}
	]
*/
import test from 'node:test';

// ❌
test('not starting with Should', () => {});

// ✅
test('Should pass when called', () => {});
test('Should throw on invalid input', () => {});
```

```js
/* eslint
	node-test/test-title-format: [
		'error',
		{
			format: '\\.$'
		}
	]
*/
import test from 'node:test';

// ❌
test('doesn\'t end with a dot', () => {});

// ✅
test('ends with a dot.', () => {});
```

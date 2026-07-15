# prefer-lowercase-title

📝 Enforce lowercase test titles.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Test titles read as a sentence describing the behavior under test (`test('returns the parsed value', …)`), so they conventionally start with a lowercase letter. Keeping them consistent makes test output easier to scan.

This rule reports a `test`/`it`/`describe`/`suite` title that starts with an uppercase letter and fixes it by lowercasing the first character. Dynamic titles (a variable, or a template literal starting with an expression) are not checked.

## Examples

```js
import {test, describe} from 'node:test';

// ❌
test('Returns the parsed value', () => {});
describe('User', () => {});

// ✅
test('returns the parsed value', () => {});
describe('user', () => {});
```

## Options

### `ignore`

Type: `string[]`\
Default: `[]`

Test functions whose titles are not checked. Allowed values: `test`, `it`, `describe`, `suite`.

```js
/* eslint
	node-test/prefer-lowercase-title: [
		'error',
		{
			ignore: [
				'describe',
				'suite'
			]
		}
	]
*/
import {describe, test} from 'node:test';

// ✅ — `describe` is ignored
describe('User', () => {
	// ❌ — `test` is still checked
	test('Has a name', () => {});
});
```

### `allowedPrefixes`

Type: `string[]`\
Default: `[]`

Title prefixes that are allowed to start with an uppercase letter, such as HTTP methods or proper nouns.

```js
/* eslint
	node-test/prefer-lowercase-title: [
		'error',
		{
			allowedPrefixes: [
				'GET',
				'POST'
			]
		}
	]
*/
import test from 'node:test';

// ✅
test('GET /users returns a list', () => {});
```

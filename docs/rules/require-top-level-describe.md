# require-top-level-describe

📝 Require tests and hooks to be inside a top-level `describe`.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

This rule enforces wrapping every test and hook in a top-level `describe`, giving each file a single named group instead of a flat list of tests. Some teams prefer this for consistent test output and to scope hooks clearly. It is opt-in, since a flat file of top-level `test()` calls is also a perfectly normal `node:test` style.

It can also cap the number of top-level `describe` blocks per file via `maxTopLevelDescribes`.

## Options

```js
{
	'node-test/require-top-level-describe': [
		'error',
		{
			maxTopLevelDescribes: 1 // optional cap on top-level `describe` blocks
		}
	]
}
```

## Examples

```js
import {describe, it, beforeEach} from 'node:test';

// ❌
beforeEach(() => {});
it('works', () => {});

// ✅
describe('feature', () => {
	beforeEach(() => {});

	it('works', () => {});
});
```

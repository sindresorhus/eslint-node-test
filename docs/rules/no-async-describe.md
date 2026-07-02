# no-async-describe

📝 Disallow `async` `describe` callbacks.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`node:test` collects the tests in a `describe`/`suite` by calling its callback and expecting every `test`/`describe` inside to be registered **synchronously**. It does not await the callback ([nodejs/node#48845](https://github.com/nodejs/node/issues/48845)), so once the callback hits an `await` the suite is already considered finished — any test registered afterwards fails with "test could not be started because its parent finished".

This rule reports `async` `describe`/`suite` callbacks. If you need asynchronous setup, do it in a hook or inside the individual tests, which _are_ awaited.

## Examples

```js
import {describe, it} from 'node:test';

// ❌ — `b` is registered after the await and is silently dropped
describe('suite', async () => {
	it('a', () => {});
	await setup();
	it('b', () => {});
});

// ✅ — register synchronously, do async work inside hooks or tests
describe('suite', () => {
	let resource;
	before(async () => {
		resource = await setup();
	});

	it('a', () => {});
	it('b', () => {});
});
```

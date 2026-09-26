# no-async-describe

📝 Disallow `async` `describe` callbacks.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`node:test` does await a `describe`/`suite` callback, so an `async` one keeps registering its tests after the first `await` and they all run once it settles. The trouble is what an `await` in that callback hides: if the callback rejects, the suite fails with the rejection and every test it already registered is cancelled with `test did not finish before its parent and was cancelled`, so a failure in asynchronous setup replaces the results of the whole suite.

This rule reports `async` `describe`/`suite` callbacks. If you need asynchronous setup, do it in a hook or inside the individual tests, where a failure is reported against the test that caused it.

## Examples

```js
import {describe, it, before} from 'node:test';

// ❌ — `b` is registered only after the await, and a rejection in `setup()` cancels the suite
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

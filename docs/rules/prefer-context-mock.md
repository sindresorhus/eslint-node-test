# prefer-context-mock

📝 Prefer the test context `t.mock` over the global `mock`.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Mocks created through the test context (`t.mock`) are [automatically restored](https://nodejs.org/api/test.html#class-mocktracker) when the test finishes. The global `mock` exported from `node:test` is **not** — its mocks persist across tests until you manually call `mock.reset()`/`mock.restoreAll()`. Forgetting that leaks a mock into later tests, causing order-dependent failures that are hard to track down.

This rule reports state-creating calls on the global `mock` (`fn`, `method`, `getter`, `setter`, `property`, `module`, and `timers.enable`) and points you to the `t.mock` equivalent. The cleanup methods (`mock.reset()`, `mock.restoreAll()`) are not reported. The other `mock.timers` calls (`tick`, `runAll`, `reset`) are not reported either: they create no new state, and they must act on the tracker that enabled the timers, so moving only them to `t.mock` would be wrong.

## Examples

```js
import {test, mock} from 'node:test';

// ❌
test('reads config', () => {
	mock.method(fs, 'readFileSync', () => '{}');
});

// ✅
test('reads config', t => {
	t.mock.method(fs, 'readFileSync', () => '{}');
});
```

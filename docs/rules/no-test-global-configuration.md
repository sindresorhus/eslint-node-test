# no-test-global-configuration

📝 Disallow process-wide `node:test` configuration inside tests.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->

`snapshot.setDefaultSnapshotSerializers()`, `snapshot.setResolveSnapshotPath()`, and `assert.register()` configure `node:test` process-wide state. Calling them from a test, subtest, or suite-local hook makes later tests depend on execution order, especially when tests run concurrently.

Prefer configuring these APIs before test registration in a setup module preloaded with `--import` or `--require`.

This rule reports direct calls on `node:test` configuration objects in inline test, subtest, and suite-local hook callbacks, including nested helper functions and callbacks. It allows top-level configuration, suite callbacks, top-level hook setup, computed properties, and destructured method aliases.

## Examples

```js
import test, {snapshot} from 'node:test';

// ❌
test('formats output', () => {
	snapshot.setDefaultSnapshotSerializers([serialize]);
});

// ✅
snapshot.setDefaultSnapshotSerializers([serialize]);

test('formats output', () => {
	// Test code.
});
```

Suite-local hooks run during their suite's test execution. Although preloaded configuration remains preferred, this rule permits top-level hooks as deliberate file-level setup:

```js
import {beforeEach, describe, snapshot} from 'node:test';

// ❌
describe('formats output', () => {
	beforeEach(() => {
		snapshot.setResolveSnapshotPath(path => path);
	});
});

// ✅
beforeEach(() => {
	snapshot.setResolveSnapshotPath(path => path);
});
```

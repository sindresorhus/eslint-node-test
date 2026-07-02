# no-unknown-test-options

📝 Disallow unknown options in test and hook option objects.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`node:test` silently ignores unknown keys in a test or hook options object. A typo like `{skp: true}` therefore does nothing — the test runs normally instead of being skipped — and the mistake is easy to miss.

This rule reports option keys that `node:test` does not recognize. Tests and suites accept `concurrency`, `expectFailure`, `only`, `plan`, `signal`, `skip`, `tags`, `timeout`, and `todo`; hooks accept `signal` and `timeout`. Computed and spread keys are skipped, since they cannot be checked statically.

> [!NOTE]
> The recognized keys track the `node:test` runner and may lag behind a newer Node.js version that adds an option. If you hit a false positive on a valid new option, open an issue.

## Examples

```js
import test from 'node:test';

// ❌
test('title', {skp: true}, () => {});

// ✅
test('title', {skip: true}, () => {});
```

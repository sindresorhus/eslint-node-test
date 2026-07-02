# no-conditional-tests

📝 Disallow conditionally registering tests and suites.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Registering a test or suite inside a condition makes the suite structure depend on runtime state, so the set of tests that run varies between environments. A test silently skipped by a condition looks the same as a passing run, which hides regressions. Put the condition inside the test body (and use `t.skip()` or the `{skip}` option), or split the file by environment instead.

This rule reports a `test`/`it`/`describe`/`suite` call guarded by an `if`, `else`, ternary, logical (`&&`/`||`), or `switch`. Loops are allowed, since iterating to register tests is the idiomatic way to write table-driven tests in `node:test`.

## Examples

```js
import {test, describe} from 'node:test';

// ❌
if (process.env.CI) {
	test('runs only on CI', () => {});
}

process.platform === 'darwin' && test('macOS only', () => {});

// ✅ (condition inside the test)
test('skips off CI', t => {
	if (!process.env.CI) {
		t.skip('CI only');
		return;
	}

	assert.ok(check());
});

// ✅ (table-driven via a loop)
for (const testCase of cases) {
	test(testCase.name, () => {
		assert.strictEqual(run(testCase.input), testCase.output);
	});
}
```

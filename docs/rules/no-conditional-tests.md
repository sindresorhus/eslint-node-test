# no-conditional-tests

📝 Disallow conditionally registering tests, suites, and hooks.

💼🚫 This rule is enabled in the ✅ `recommended` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs). This rule is _disabled_ in the ☑️ `unopinionated` [config](https://github.com/sindresorhus/eslint-node-test#preset-configs).

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Registering a test, suite, or hook inside a condition makes the suite structure depend on runtime state, so the tests, setup, and teardown that run vary between environments. A test silently skipped by a condition looks the same as a passing run, and a skipped hook can make setup or teardown silently differ. Put the condition inside the test or hook body, or split the file by environment instead.

This rule reports a `test`/`it`/`describe`/`suite`/`before`/`after`/`beforeEach`/`afterEach` call guarded by an `if`, `else`, ternary, logical (`&&`/`||`/`??`), or `switch`. Loops are allowed, since iterating to register tests is the idiomatic way to write table-driven tests in `node:test`. The rule only checks lexical ancestors of the registration call and does not trace callbacks passed to helper methods.

## Examples

```js
import {test, describe, beforeEach} from 'node:test';

// ❌
if (process.env.CI) {
	test('runs only on CI', () => {});
}

process.platform === 'darwin' && test('macOS only', () => {});

if (process.env.CI) {
	beforeEach(() => {
		startServer();
	});
}

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

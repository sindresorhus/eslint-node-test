# consistent-test-context-name

📝 Enforce a consistent name for the test context parameter.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

The test and subtest callbacks receive a test context object, conventionally named `t` (`test('…', t => {})`). Using a consistent name keeps `t.assert`, `t.mock`, `t.test`, and `t.plan` recognizable across a codebase.

This rule reports a `test`/`it` (or subtest) callback whose first parameter is named something other than the configured name. Callbacks with no parameter, or that destructure the context, are left alone.

## Options

- `name` (string, default `'t'`) — the required parameter name.

```js
{
	'node-test/consistent-test-context-name': [
		'error',
		{
			name: 't'
		}
	]
}
```

## Examples

```js
import test from 'node:test';

// ❌
test('reads a file', context => {
	context.assert.ok(result);
});

// ✅
test('reads a file', t => {
	t.assert.ok(result);
});
```

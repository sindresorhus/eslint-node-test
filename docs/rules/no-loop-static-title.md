# no-loop-static-title

📝 Disallow a static test or suite title inside a loop.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Generating tests in a loop is a common pattern, but if the title is a static string, every iteration registers a test with the *same* title. That makes failures ambiguous (you cannot tell which iteration failed) and defeats the purpose of looping. The fix is to include the loop variable in the title.

This rule reports a `test`/`it`/`describe`/`suite` call whose title resolves to a constant string when it appears directly inside a loop (`for`, `for…of`, `for…in`, `while`, `do…while`) or inside a `map`/`forEach`/`flatMap` callback. A title that interpolates the loop variable is not static, so it is left alone. A static title nested under a dynamically-named `describe` is also fine, since the parent suite makes it unique.

Unlike [`no-identical-title`](./no-identical-title.md), which compares distinct call sites, this rule catches duplicates produced by a single call site that runs many times.

## Examples

```js
import {test} from 'node:test';

// ❌
for (const input of inputs) {
	test('handles input', () => {
		assert.ok(process(input));
	});
}

// ✅
for (const input of inputs) {
	test(`handles ${input}`, () => {
		assert.ok(process(input));
	});
}
```

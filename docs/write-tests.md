# Writing tests

Tests are in the `/test` directory.

A rule test file should look like this:

```js
import {getTester} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		// Valid test cases goes here
	],
	invalid: [
		// Valid test cases goes here
	]，
});
```

## `test.snapshot()`

This runs [`SnapshotRuleTester`](../test/utils/snapshot-rule-tester.js), which auto-generates the snapshot for test results, including error messages, error locations, autofix result, and suggestions. All you have to do is check the snapshot and make sure the results are expected before committing.

It's recommended to use this approach as it simplifies test writing.

```js
import {getTester} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [
		'valid.code',
	],
	invalid: [
		'invalid.code',
	]，
});
```

## Focus on one rule

We use the [Node.js built-in test runner](https://nodejs.org/api/test.html) (`node:test`) to run tests. To focus on a specific rule test, you can:

```console
node --test test/rule-name.js
```

To update snapshots, add [`--test-update-snapshots`](https://nodejs.org/api/test.html#snapshot-testing):

```console
node --test --test-update-snapshots test/rule-name.js
```

## Focus on one test case

To focus on a single test case, you can:

```js
test.snapshot({
	valid: [],
	invalid: [
		// Tagged template with `test.only`
		test.only`code`,

		// Wrap code with `test.only`
		test.only('code'),

		// Wrap test case with `test.only`
		test.only({
			code: 'code',
			options: [{checkFoo: true}],
		}),

		// Use `only: true`
		{
			code: 'code',
			options: [{checkFoo: true}],
			only: true,
		},
	],
})
```

**Please remove `test.only` and `only: true` before committing.**

## `testerOptions`

`test` and `test.*()` accepts `testerOptions`, which lets you specify common `parseOptions` to all test cases.

```js
test.snapshot({
	testerOptions: {
		languageOptions: {
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
		},
	},
	valid: [],
	invalid: [],
})
```

## `parsers`

[`utils/test.js`](../test/utils/test.js) also exposes a `parsers` object, which can be used in `testerOptions` or `parser` for a single test case.

```js
import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	testerOptions: {
		languageOptions: {
			parser: parsers.typescript,
		},
	},
	valid: [],
	invalid: [],
})
```

```js
import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

test.snapshot({
	valid: [],
	invalid: [
		{
			code: 'const foo = 1 as const;',
			languageOptions: {
				parser: parsers.typescript,
			},
		},
	],
})
```

Why use `parser: parsers.typescript` instead of `parser: '@typescript-eslint/parser'`?

Using `parsers.typescript` will make the `parserOptions` merge with useful default options. See [`parsers.js`](../test/utils/parsers.js) for details.

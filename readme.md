# eslint-node-test

> ESLint rules for the [Node.js built-in test runner](https://nodejs.org/api/test.html) (`node:test`)

This plugin helps you avoid common mistakes and write more consistent tests with `node:test`, the test runner built into Node.js.

## Install

```sh
npm install --save-dev eslint eslint-node-test
```

**Requires ESLint `>=10.4`, [flat config](https://eslint.org/docs/latest/use/configure/configuration-files), and [ESM](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c#how-can-i-make-my-typescript-project-output-esm).**

## Usage

Use a [preset config](#preset-configs) or configure each rule in `eslint.config.js`.

```js
import eslintNodeTest from 'eslint-node-test';
import {defineConfig} from 'eslint/config';

export default defineConfig([
	eslintNodeTest.configs.recommended,
]);
```

Or configure rules individually:

```js
import eslintNodeTest from 'eslint-node-test';
import {defineConfig} from 'eslint/config';

export default defineConfig([
	{
		plugins: {
			'node-test': eslintNodeTest,
		},
		rules: {
			'node-test/no-only-test': 'error',
			'node-test/no-identical-title': 'error',
		},
	},
]);
```

The rules only activate in files that import from `node:test` (and assertion rules also activate for Node's built-in `assert` module), so you can safely apply the plugin across your whole project.

## Rules

<!-- begin auto-generated rules list -->

💼 [Configurations](https://github.com/sindresorhus/eslint-node-test#preset-configs) enabled in.\
✅ Set in the `recommended` [configuration](https://github.com/sindresorhus/eslint-node-test#preset-configs).\
☑️ Set in the `unopinionated` [configuration](https://github.com/sindresorhus/eslint-node-test#preset-configs).\
🔧 Automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/user-guide/command-line-interface#--fix).\
💡 Manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

| Name                                                                                             | Description                                                                                                | 💼   | 🔧 | 💡 |
| :----------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- | :--- | :- | :- |
| [assertion-arguments](docs/rules/assertion-arguments.md)                                         | Enforce the correct number of arguments for `node:assert` assertions.                                      | ✅ ☑️ |    |    |
| [consistent-assert-style](docs/rules/consistent-assert-style.md)                                 | Enforce a consistent truthiness assertion style.                                                           | ✅    | 🔧 |    |
| [consistent-assert-throws-callback-style](docs/rules/consistent-assert-throws-callback-style.md) | Enforce a consistent body style for `assert.throws()` arrow callbacks.                                     |      | 🔧 |    |
| [consistent-modifier-style](docs/rules/consistent-modifier-style.md)                             | Enforce a consistent style for test modifiers.                                                             |      |    |    |
| [consistent-test-context-name](docs/rules/consistent-test-context-name.md)                       | Enforce a consistent name for the test context parameter.                                                  | ✅ ☑️ |    |    |
| [consistent-test-filename](docs/rules/consistent-test-filename.md)                               | Enforce a consistent test file name pattern.                                                               |      |    |    |
| [consistent-test-it](docs/rules/consistent-test-it.md)                                           | Enforce consistent use of `test` or `it`.                                                                  |      |    |    |
| [hooks-order](docs/rules/hooks-order.md)                                                         | Enforce a consistent order of hook declarations.                                                           | ✅ ☑️ | 🔧 |    |
| [max-assertions](docs/rules/max-assertions.md)                                                   | Enforce a maximum number of assertions in a test.                                                          |      |    |    |
| [max-nested-describe](docs/rules/max-nested-describe.md)                                         | Enforce a maximum depth for nested `describe` blocks.                                                      | ✅    |    |    |
| [no-assert-in-describe](docs/rules/no-assert-in-describe.md)                                     | Disallow assertions directly inside a `describe` body.                                                     | ✅    |    |    |
| [no-assert-in-hook](docs/rules/no-assert-in-hook.md)                                             | Disallow assertions inside hooks.                                                                          |      |    |    |
| [no-assert-match-string](docs/rules/no-assert-match-string.md)                                   | Disallow strings as the regexp argument of `assert.match()`/`assert.doesNotMatch()`.                       | ✅ ☑️ |    | 💡 |
| [no-assert-throws-async](docs/rules/no-assert-throws-async.md)                                   | Disallow passing an async function to `assert.throws()`/`assert.doesNotThrow()`.                           | ✅ ☑️ |    | 💡 |
| [no-assert-throws-call](docs/rules/no-assert-throws-call.md)                                     | Disallow calling the function passed to `assert.throws()`.                                                 | ✅ ☑️ |    | 💡 |
| [no-assert-throws-multiple-statements](docs/rules/no-assert-throws-multiple-statements.md)       | Disallow multiple statements in `assert.throws()`/`assert.rejects()` callbacks.                            | ✅    |    |    |
| [no-assert-throws-string](docs/rules/no-assert-throws-string.md)                                 | Disallow a string as the error matcher of `assert.throws()`/`assert.rejects()`.                            | ✅ ☑️ |    | 💡 |
| [no-async-describe](docs/rules/no-async-describe.md)                                             | Disallow `async` `describe` callbacks.                                                                     | ✅ ☑️ |    |    |
| [no-async-fn-without-await](docs/rules/no-async-fn-without-await.md)                             | Disallow async test/hook functions that have no `await` expression.                                        | ✅ ☑️ |    | 💡 |
| [no-callback-and-promise](docs/rules/no-callback-and-promise.md)                                 | Disallow a test or hook from using both a callback and a Promise.                                          | ✅ ☑️ |    |    |
| [no-commented-tests](docs/rules/no-commented-tests.md)                                           | Disallow commented-out tests.                                                                              |      |    |    |
| [no-compound-assertion](docs/rules/no-compound-assertion.md)                                     | Disallow compound truthiness assertions.                                                                   | ✅ ☑️ | 🔧 |    |
| [no-conditional-assertion](docs/rules/no-conditional-assertion.md)                               | Disallow assertions inside conditional code within a test.                                                 | ✅ ☑️ |    |    |
| [no-conditional-in-test](docs/rules/no-conditional-in-test.md)                                   | Disallow conditional logic inside tests.                                                                   |      |    |    |
| [no-conditional-tests](docs/rules/no-conditional-tests.md)                                       | Disallow conditionally registering tests, suites, and hooks.                                               | ✅    |    |    |
| [no-conflicting-modifiers](docs/rules/no-conflicting-modifiers.md)                               | Disallow conflicting test modifiers.                                                                       | ✅ ☑️ |    |    |
| [no-constant-assertion](docs/rules/no-constant-assertion.md)                                     | Disallow assertions with constant outcomes.                                                                | ✅ ☑️ |    |    |
| [no-done-callback](docs/rules/no-done-callback.md)                                               | Disallow callback (`done`) parameters in tests and hooks.                                                  |      |    |    |
| [no-duplicate-assertions](docs/rules/no-duplicate-assertions.md)                                 | Disallow adjacent duplicate assertions.                                                                    | ✅ ☑️ |    |    |
| [no-duplicate-hooks](docs/rules/no-duplicate-hooks.md)                                           | Disallow duplicate hooks within the same scope.                                                            | ✅    |    |    |
| [no-duplicate-mock-timers-enable](docs/rules/no-duplicate-mock-timers-enable.md)                 | Disallow enabling mock timers more than once without resetting them.                                       | ✅ ☑️ |    |    |
| [no-duplicate-plan](docs/rules/no-duplicate-plan.md)                                             | Disallow setting a test plan more than once in the same test.                                              | ✅ ☑️ |    |    |
| [no-expect-failure-without-reason](docs/rules/no-expect-failure-without-reason.md)               | Require a reason when marking a test or suite as expected to fail.                                         | ✅    |    |    |
| [no-export](docs/rules/no-export.md)                                                             | Disallow exports from test files.                                                                          | ✅    |    |    |
| [no-identical-assertion-arguments](docs/rules/no-identical-assertion-arguments.md)               | Disallow comparing a value to itself in an assertion.                                                      | ✅ ☑️ |    |    |
| [no-identical-title](docs/rules/no-identical-title.md)                                           | Disallow identical test titles within the same scope.                                                      | ✅ ☑️ |    |    |
| [no-import-test-files](docs/rules/no-import-test-files.md)                                       | Disallow imports of Node.js test files.                                                                    | ✅ ☑️ |    |    |
| [no-incorrect-deep-equal](docs/rules/no-incorrect-deep-equal.md)                                 | Disallow `deepEqual`/`deepStrictEqual` (and their `notDeep*` variants) when comparing with primitives.     | ✅ ☑️ | 🔧 |    |
| [no-incorrect-strict-equal](docs/rules/no-incorrect-strict-equal.md)                             | Disallow `strictEqual`/`equal` (and their `not*` variants) when comparing with an object or array literal. | ✅ ☑️ | 🔧 |    |
| [no-late-test-activity](docs/rules/no-late-test-activity.md)                                     | Disallow test activity inside detached asynchronous callbacks.                                             | ✅ ☑️ | 🔧 |    |
| [no-loop-static-title](docs/rules/no-loop-static-title.md)                                       | Disallow a static test or suite title inside a loop.                                                       | ✅ ☑️ |    |    |
| [no-misused-concurrency](docs/rules/no-misused-concurrency.md)                                   | Disallow the `concurrency` option on a test without subtests.                                              | ✅ ☑️ |    |    |
| [no-misused-context-hook](docs/rules/no-misused-context-hook.md)                                 | Disallow context hooks without runnable subtests.                                                          | ✅ ☑️ |    |    |
| [no-mock-timers-destructured-import](docs/rules/no-mock-timers-destructured-import.md)           | Disallow destructured timer imports when using `mock.timers`.                                              | ✅ ☑️ |    |    |
| [no-nested-tests](docs/rules/no-nested-tests.md)                                                 | Disallow tests and suites nested inside a test body.                                                       | ✅ ☑️ |    |    |
| [no-only-test](docs/rules/no-only-test.md)                                                       | Disallow the `.only` test modifier.                                                                        | ✅ ☑️ |    | 💡 |
| [no-parent-test-context](docs/rules/no-parent-test-context.md)                                   | Disallow references to parent test contexts inside subtests.                                               | ✅ ☑️ |    | 💡 |
| [no-process-chdir-in-test](docs/rules/no-process-chdir-in-test.md)                               | Disallow changing the working directory inside tests.                                                      | ✅    |    |    |
| [no-process-env-mutation](docs/rules/no-process-env-mutation.md)                                 | Disallow mutating `process.env` inside tests.                                                              | ✅    |    |    |
| [no-process-exit-in-test](docs/rules/no-process-exit-in-test.md)                                 | Disallow process exit control in test files.                                                               | ✅ ☑️ |    |    |
| [no-skip-test](docs/rules/no-skip-test.md)                                                       | Disallow the `.skip` test modifier.                                                                        | ✅    |    | 💡 |
| [no-skip-without-reason](docs/rules/no-skip-without-reason.md)                                   | Require a reason when skipping or marking a test as todo.                                                  |      |    |    |
| [no-skip-without-return](docs/rules/no-skip-without-return.md)                                   | Disallow `t.skip()`/`t.todo()` without returning afterwards.                                               | ✅    |    | 💡 |
| [no-sleep-in-test](docs/rules/no-sleep-in-test.md)                                               | Disallow sleeping in tests with `setTimeout`.                                                              |      |    |    |
| [no-snapshot-in-loop](docs/rules/no-snapshot-in-loop.md)                                         | Disallow snapshot assertions inside loop bodies.                                                           |      |    |    |
| [no-standalone-assert](docs/rules/no-standalone-assert.md)                                       | Disallow assertions outside of a test.                                                                     | ✅ ☑️ |    |    |
| [no-test-global-configuration](docs/rules/no-test-global-configuration.md)                       | Disallow process-wide `node:test` configuration inside tests.                                              | ✅    |    |    |
| [no-test-inside-hook](docs/rules/no-test-inside-hook.md)                                         | Disallow defining tests and suites inside a hook.                                                          | ✅ ☑️ |    |    |
| [no-test-return-statement](docs/rules/no-test-return-statement.md)                               | Disallow returning a concrete non-Promise value from a test or hook.                                       | ✅    |    |    |
| [no-todo-test](docs/rules/no-todo-test.md)                                                       | Disallow the `.todo` test modifier.                                                                        |      |    | 💡 |
| [no-unawaited-promise-assertion](docs/rules/no-unawaited-promise-assertion.md)                   | Disallow assertions inside unawaited Promise callbacks.                                                    | ✅ ☑️ | 🔧 |    |
| [no-unawaited-rejects](docs/rules/no-unawaited-rejects.md)                                       | Require `assert.rejects()`/`assert.doesNotReject()` to be awaited or returned.                             | ✅ ☑️ | 🔧 |    |
| [no-unawaited-subtest](docs/rules/no-unawaited-subtest.md)                                       | Require subtests created with the test context to be awaited or returned.                                  | ✅    | 🔧 |    |
| [no-unknown-test-options](docs/rules/no-unknown-test-options.md)                                 | Disallow unknown options in test and hook option objects.                                                  | ✅    |    |    |
| [no-unneeded-async-rejects-callback](docs/rules/no-unneeded-async-rejects-callback.md)           | Disallow unneeded async callbacks passed to `assert.rejects()`.                                            |      |    | 💡 |
| [no-useless-assertion](docs/rules/no-useless-assertion.md)                                       | Disallow `assert.doesNotThrow()` and `assert.doesNotReject()`.                                             | ✅    |    |    |
| [prefer-assert-match](docs/rules/prefer-assert-match.md)                                         | Prefer `assert.match()`/`assert.doesNotMatch()` over asserting `RegExp#test()` / `String#match()` results. | ✅ ☑️ | 🔧 |    |
| [prefer-assert-throws](docs/rules/prefer-assert-throws.md)                                       | Prefer `assert.throws()`/`assert.rejects()` over try/catch with an assertion.                              | ✅    |    |    |
| [prefer-async-await](docs/rules/prefer-async-await.md)                                           | Prefer async/await over returning a Promise.                                                               | ✅    |    |    |
| [prefer-context-mock](docs/rules/prefer-context-mock.md)                                         | Prefer the test context `t.mock` over the global `mock`.                                                   | ✅    |    |    |
| [prefer-diagnostic](docs/rules/prefer-diagnostic.md)                                             | Prefer the test context `diagnostic()` over `console` inside tests.                                        |      |    | 💡 |
| [prefer-equality-assertion](docs/rules/prefer-equality-assertion.md)                             | Prefer an equality assertion over a truthiness assertion on a comparison.                                  | ✅ ☑️ | 🔧 |    |
| [prefer-hooks-on-top](docs/rules/prefer-hooks-on-top.md)                                         | Require hooks to be declared before the tests in their scope.                                              | ✅    |    |    |
| [prefer-lowercase-title](docs/rules/prefer-lowercase-title.md)                                   | Enforce lowercase test titles.                                                                             |      | 🔧 |    |
| [prefer-mock-accessor](docs/rules/prefer-mock-accessor.md)                                       | Prefer `mock.getter()` and `mock.setter()` over `mock.method()` with accessor options.                     | ✅    | 🔧 |    |
| [prefer-mock-call-count](docs/rules/prefer-mock-call-count.md)                                   | Prefer `mock.callCount()` over `mock.calls.length`.                                                        | ✅ ☑️ | 🔧 |    |
| [prefer-mock-method](docs/rules/prefer-mock-method.md)                                           | Prefer `mock.method()` over assigning `mock.fn()` to an object property.                                   | ✅    |    | 💡 |
| [prefer-strict-assert](docs/rules/prefer-strict-assert.md)                                       | Prefer strict assertion methods over their legacy loose counterparts.                                      | ✅ ☑️ | 🔧 |    |
| [prefer-test-context-assert](docs/rules/prefer-test-context-assert.md)                           | Prefer the test context `t.assert` over the imported `node:assert`.                                        | ✅    |    | 💡 |
| [prefer-todo](docs/rules/prefer-todo.md)                                                         | Prefer `.todo` for empty placeholder tests.                                                                | ✅    |    | 💡 |
| [require-assertion](docs/rules/require-assertion.md)                                             | Require that each test contains at least one assertion.                                                    | ✅    |    |    |
| [require-await-concurrent-subtests](docs/rules/require-await-concurrent-subtests.md)             | Require subtests created in a loop callback to be awaited.                                                 | ✅ ☑️ |    |    |
| [require-context-assert-with-plan](docs/rules/require-context-assert-with-plan.md)               | Require assertions to use the test context when the test sets a plan.                                      | ✅ ☑️ |    |    |
| [require-hook](docs/rules/require-hook.md)                                                       | Require setup and teardown code to be inside a hook.                                                       |      |    |    |
| [require-mock-timers-advance](docs/rules/require-mock-timers-advance.md)                         | Require mock timers to be advanced after enabling timer APIs.                                              | ✅    |    |    |
| [require-mock-timers-apis](docs/rules/require-mock-timers-apis.md)                               | Require an explicit `apis` option when enabling `mock.timers`.                                             | ✅ ☑️ |    |    |
| [require-throws-expectation](docs/rules/require-throws-expectation.md)                           | Require an error matcher for `assert.throws()`/`assert.rejects()`.                                         | ✅ ☑️ |    |    |
| [require-throws-validator-return-true](docs/rules/require-throws-validator-return-true.md)       | Require validator functions in `assert.throws()`/`assert.rejects()` to return `true`.                      | ✅ ☑️ |    |    |
| [require-top-level-describe](docs/rules/require-top-level-describe.md)                           | Require tests and hooks to be inside a top-level `describe`.                                               |      |    |    |
| [test-title](docs/rules/test-title.md)                                                           | Require tests to have a title.                                                                             | ✅    | 🔧 |    |
| [test-title-format](docs/rules/test-title-format.md)                                             | Require test titles to match a configured pattern.                                                         |      |    |    |
| [valid-describe-callback](docs/rules/valid-describe-callback.md)                                 | Enforce valid `describe` callbacks.                                                                        | ✅ ☑️ |    |    |

<!-- end auto-generated rules list -->

## Preset configs

This plugin exports these configs:

- `recommended` — Enables the recommended rules.
- `unopinionated` — A subset of `recommended` with only the most uncontroversial rules.
- `all` — Enables every rule (not recommended for general use; useful to discover new rules).

```js
import eslintNodeTest from 'eslint-node-test';
import {defineConfig} from 'eslint/config';

export default defineConfig([
	eslintNodeTest.configs.recommended,
]);
```

## Related

- [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn) — Lots of awesome ESLint rules.
- [eslint-package-json](https://github.com/sindresorhus/eslint-package-json) — Powerful ESLint rules for `package.json`.
- [eslint-plugin-ava](https://github.com/avajs/eslint-plugin-ava) — ESLint rules for AVA.
- [test-extras](https://github.com/sindresorhus/test-extras) — Assertions and utilities that make `node:test` better.

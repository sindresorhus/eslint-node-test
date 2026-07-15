# Agents

## Philosophy

This plugin lints tests written with the Node.js built-in test runner (`node:test`).

Keep rules simple. Target common patterns, skip rare edge cases rather than overcomplicating the rule.

## Detecting `node:test`

`node:test` is import-based. Every rule first resolves the file's imports and then matches calls against the resolved local names. Use the shared helper `rules/utils/node-test.js`:

- `resolveImports(context)` — scans the file's top-level `import` declarations and returns `{locals, namespace, assertNamespace, assertNamed}`. `locals` maps a local identifier to its canonical `node:test` export (`test`, `it`, `describe`, `suite`, `before`, `after`, `beforeEach`, `afterEach`, `mock`). Handles default import (`import test from 'node:test'`), named/renamed imports, and namespace import. CommonJS `require` is not supported. Most rules bail early when the file does not import `node:test`: `if (imports.locals.size === 0 && !imports.namespace) { return; }`.
- `parseTestCall(callExpression, imports)` — classifies a call as a test/suite/hook: returns `{name, kind, modifiers}` where `kind` is `'test'` (`test`/`it`), `'suite'` (`describe`/`suite`), or `'hook'`, and `modifiers` are the chained `.only`/`.skip`/`.todo` identifier nodes.
- `findModifier`, `getTestOptions`, `findOptionsProperty` — for the two ways a modifier is applied: chained (`test.only(…)`) and via the options object (`test('t', {only: true}, fn)`).
- `getTestTitle(call, context)`, `getStaticString(node, context)` — resolve static string titles.
- `getTestCallback(call)` — the inline implementation function (the last function argument).
- `parseAssertionCall(call, imports)` — classifies a `node:assert` assertion: `assert.strictEqual(…)`, bare `assert(…)`, named-import `strictEqual(…)`, or `t.assert.strictEqual(…)`. Returns `{method}`. Assertion rules activate on a `node:assert` import (not necessarily `node:test`), since the advice is correct wherever `node:assert` is used.

Note: subtests created via the test context (`t.test(…)`) are method calls, not imported bindings, so they are intentionally not matched by `parseTestCall`.

## Rule anatomy

Rules export a default config object with `create` and `meta`. The `create` function uses `context.on(NodeType, listener)` to register visitors (this is a plugin-specific adapter API, not standard ESLint). See the [ESLint custom rules guide](https://eslint.org/docs/latest/extend/custom-rules) for the underlying API.

Key differences from standard ESLint:

- Use `context.on('NodeType', listener)` and `context.onExit('NodeType', listener)` instead of returning a visitor object.
- Listeners return or yield problem objects (`{node, messageId, fix, suggest, data}`) directly. The adapter calls `context.report()` for you.
- Fix functions receive `(fixer, {abort})`. Call `abort()` to bail out of an unfixable case.

```js
const MESSAGE_ID = 'rule-name';

const messages = {
	[MESSAGE_ID]: 'Error message with {{placeholder}}.'
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	context.on('CallExpression', node => {
		return {
			node,
			messageId: MESSAGE_ID,
			data: {placeholder: 'value'},
			fix: fixer => fixer.replaceText(node, 'replacement')
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Enforce …',
			recommended: true // 'unopinionated' (safest, in both presets), true (in recommended only), or false (opt-in)
		},
		fixable: 'code', // or omit; add hasSuggestions: true for suggestions
		schema: [],
		defaultOptions: [
			{
				option: 'default'
			}
		], // merged automatically
		messages
	}
};
export default config;
```

Options are accessed via `context.options[0]`. Use `meta.defaultOptions` for defaults (no manual merging).

### `recommended` config level

`meta.docs.recommended` picks the preset that enables the rule. `'unopinionated'` does NOT mean "too opinionated" — it means the opposite:

- **`'unopinionated'`** — Uncontroversial; in both `unopinionated` and `recommended` (the former is a subset). Safest bucket and the default for new rules.
- **`true`** — A more opinionated call, still on by default. In `recommended` only.
- **`false`** — Off by default, only in `all`. For niche or opt-in rules.

| `recommended` | `unopinionated` | `recommended` config | `all` |
|---|---|---|---|
| `'unopinionated'` | on | on | on |
| `true` | off | on | on |
| `false` (or omitted) | off | off | on |

So a rule too opinionated or niche for broad use is `false`, never `'unopinionated'`. If unsure which level fits, share your recommendation and ask.

Name boolean options in the positive `check*` form (for example, `checkProperties`), never the negated `ignore*`/`skip*` form, so option naming stays consistent across rules. This does not apply to array/pattern options like `ignore` (a list of patterns to ignore), which follow ESLint's own conventions.

### Helper naming

Name helpers after what they return or do:

- `is*`/`has*`/`should*`/`can*`/`needs*` must return booleans. Prefer explicit `false` over `undefined` in predicate helpers.
- `get*Problem` returns one problem object or `undefined`; `get*Problems` returns/yields multiple problem objects.
- `report*` should call `context.report()` directly.
- Avoid `check*` for private helpers. Reserve `check*` for public boolean options, like `checkProperties`.
- Do not combine reporting/yielding with a predicate return. Split into a problem builder and a boolean at the call site.

## Rule languages

This plugin only lints JavaScript/TypeScript test files, so every rule declares the official [`meta.languages`](https://eslint.org/docs/latest/extend/custom-rules#rule-languages) field as `['js/js']`.

## Reusable utilities

The infrastructure (rule adapter, snapshot test harness, doc generation) is adapted from `../eslint-plugin-unicorn`. Look in both for existing utilities and patterns before writing new ones here.

Before writing helpers, check these directories:

- **`rules/ast/`** - AST node type checks: `isMethodCall`, `isMemberExpression`, `isFunction`, `isLoop`, `isExpressionStatement`, `isStringExpression`, `isBooleanLiteral`, `isRegexLiteral`, `getStaticStringValue`, etc.
- **`rules/utils/`** - General utilities: parenthesis helpers (`isParenthesized`, `getParenthesizedRange`, `getParentheses`), `isSameReference`, `isValueNotUsable`, `isPromiseType`, `isConditionalBranch`, `getEnclosingFunction`, `getComments`, `unwrapTypeScriptExpression`, etc.
- **`rules/fix/`** - Fixer helpers: `removeArgument`, `removeMemberExpressionProperty`.
- **`rules/shared/`** - Shared rule logic for rules that share patterns (e.g., `test-modifier-rule.js`).

Also check `../eslint-plugin-unicorn/rules/ast/`, `../eslint-plugin-unicorn/rules/utils/`, and `../eslint-plugin-unicorn/rules/fix/` — this plugin's helpers were adapted from there and equivalents may already exist for a pattern this plugin doesn't have yet.

Import from the barrel `index.js` in each directory (e.g., `import {isMethodCall} from './ast/index.js'`).

If a helper becomes complicated and clearly general across rules, consider moving it to a shared utility. Keep simple or rule-specific helpers local.

Also use `@eslint-community/eslint-utils` for helpers like `findVariable`, `getStaticValue`, and token predicates (`isCommaToken`, `isOpeningParenToken`, `isClosingParenToken`, etc.).

Most commonly used utilities:

- **`isFunction`** - Check if a node is a function (declaration, expression, or arrow function).
- **`unwrapTypeScriptExpression`**, **`isTypeScriptExpressionWrapper`** - Unwrap `as`/`satisfies`/non-null-assertion wrappers to reach the underlying expression.
- **`isParenthesized`**, **`getParenthesizedRange`** (from `rules/utils/`) - Handle extra parentheses around nodes.
- **`isValueNotUsable`** - Check if a call expression's return value is unused (safe to change behavior).
- **`findVariable`** (from `@eslint-community/eslint-utils`) - Resolve a variable's scope binding.
- **`getStaticValue`** (from `@eslint-community/eslint-utils`) - Get a node's static value at lint time.
- **`removeArgument`** - Common fix helper for dropping a call argument.

## Code path analysis

Use [ESLint's code path analysis API](https://eslint.org/docs/latest/extend/code-path-analysis) when a rule needs to know whether control flow always exits a branch or function body (e.g., via `return`, `throw`, `break`, `continue`, exhaustive `switch`, infinite loop). CPA is more accurate than manual AST walking because it handles complex constructs like `try`/`catch`/`finally`, labeled breaks, and unreachable code after infinite loops.

When to use CPA instead of manual AST walking:

- **Checking if an `if` branch always exits** — Use `trackBranchExits` from `rules/utils/`. It registers CPA event listeners and returns a predicate `(branch) => boolean`. Query it after the `IfStatement` has exited (use `context.onExit`). Used by `no-useless-else`, `no-declarations-before-early-exit`, `prefer-else-if`.
- **Checking if a function body always exits** — Track segments per code path using `onCodePathStart`/`onCodePathEnd`/`onCodePathSegmentStart`/`onCodePathSegmentEnd`/`onUnreachableCodePathSegmentStart`/`onUnreachableCodePathSegmentEnd`. Snapshot segment reachability at `BlockStatement:exit` for function bodies (before code path segments end). See `require-proxy-trap-boolean-return` for the pattern.

Key implementation notes:

- Use a **per-code-path segment stack** (`segmentSetStack`) so nested functions don't pollute the enclosing path's state.
- When checking CPA data from a parent node, use `context.onExit` (not `context.on`) so inner code paths have been fully analyzed.
- At `onCodePathEnd`, all segments have already ended, so `currentSegments()` is empty. Snapshot reachability at the AST node exit (e.g., `BlockStatement:exit`) instead.
- `trackBranchExits` uses a `prevSegments`-based check: a branch "falls through" if any post-if merge segment has a `prevSegment` in the branch's terminal segment set.

When NOT to use CPA:

- Simple last-statement checks (e.g., "does the last statement return?") — just check `node.type`.
- Collecting return statements or associating them with functions — a simple function stack or AST walk is fine.
- Fixer logic that only needs to know "return or throw" in the last position — no CPA needed.

## Auto-generated files

- **`rules/index.js`** is auto-generated. Never edit it by hand. Run `npm run create-rules-index-file` to regenerate after adding or removing rules.
- **Doc headers** in `docs/rules/<rule>.md` (everything above `<!-- end auto-generated rule header -->`) are auto-generated by `eslint-doc-generator`. Do not edit them. Run `npm run fix:eslint-docs` to update.

On rebase, `rules/index.js` and the `readme.md` rules table almost always conflict because other rules were added meanwhile. Don't hand-resolve `rules/index.js` — take either side, then run `npm run create-rules-index-file`. For `readme.md`, keep both rows and re-sort the table alphabetically.

## Documentation

Use JavaScript syntax for configuration examples, not JSON-style quoted keys and strings, unless the example is specifically JSON.
Use single quotes for strings in JavaScript documentation examples.
For rule configuration examples, put the severity and options on separate lines inside the rule array when the rule has options.
Put non-empty option and configuration arrays in documentation examples on separate lines, with each element on its own line inside the brackets. This includes nested option arrays and config arrays such as `files` and `extends`: even short options like `ignore` and `allowedPrefixes` must not use an inline array. Do not apply this to ordinary test data such as `[1, 2, 3]`.
Omit trailing commas in documentation examples.
For rule examples, keep the `## Examples` heading. Prefer pairing each failing example with its passing counterpart in the same code block when feasible, and avoid one large block containing all failing and passing examples.

## Testing

Tests should be comprehensive with many edge cases, but no duplicate coverage. Add lots of focused edge-case tests for matching and fixes/suggestions. Add tests for edge cases the rule intentionally ignores to document the behavior.

Tests run on the Node.js built-in test runner (`node:test`) with strict assertions (`node:assert/strict`). Rule tests use `test.snapshot()`, which auto-generates snapshots for errors, fixes, and suggestions (stored next to each test file as `test/<rule>.js.snapshot`):

```js
import {getTester} from './utils/test.js';
const {test} = getTester(import.meta);

test.snapshot({
	valid: ['validCode'],
	invalid: ['invalidCode']
});
```

For TypeScript cases within a `test.snapshot()` block, pass a parser per case: `{code, languageOptions: {parser: parsers.typescript}}`. Import `parsers` from `./utils/test.js`.

- **While developing, only run targeted tests**: `node --test test/rule-name.js`. Do not run `npm test` or the full suite until all changes are complete.
- **Only run the full test suite (`npm test`) once at the very end** to confirm everything passes.
- **Dogfooding**: the plugin runs its own rules on this codebase. It runs automatically as part of `npm run lint` (the `lint:dogfooding` task) and thus `npm test`; you can also run it directly with `npm run run-rules-on-codebase`. Re-run after each fix — fixes to rule logic often surface new violations elsewhere. Delete any scratch files first (e.g. in `.ai-temporary/`), or the dogfooding run lints them too.
- Update snapshots: `node --test --test-update-snapshots test/rule-name.js` (or `npm run fix:snapshots` for all).
- Unit tests for utilities live in `test/unit/` and use plain `node:test` + `node:assert/strict`.

### Edge cases to test

Include test cases for these when relevant to the rule:

- **TypeScript** - Type assertions (`foo as Bar`, `<Bar>foo`), non-null assertions (`foo!`), `satisfies`, generics. Verify both matching and fixer/suggestion output, including optional chaining behavior and ASI protection when the output can start with `(` or `[`. Use `{code, parser: parsers.typescript}`.
- **JSX** - JSX expressions and fragments, if the rule targets patterns that can appear in JSX.
- **Comments** - Inline and block comments inside the targeted node, to verify fixes don't drop them.
- **Parenthesized expressions** - Extra parentheses around the target: `(foo).bar()`.
- **Nested/chained** - The pattern appearing inside other expressions or chained calls.
- **Computed properties** - `obj[method]()` vs `obj.method()`.
- **Tagged templates** - `` tag`string` ``.
- **Optional chaining** - `foo?.bar()`, `foo?.bar?.baz`.
- **Spread** - `[...foo]`, `{...foo}`, `fn(...args)`.
- **Destructuring** - The pattern inside destructuring assignments or parameters.
- **Return value used vs unused** - `const x = foo.bar()` vs `foo.bar()` as a statement. Some fixes are only safe when the return value is unused (see `isValueNotUsable`).

## Linting

CI lints with **ESLint**, not `xo` — a clean `npx xo` run does not mean CI passes.

Run `npm run fix` (or `npm run fix:js` for JS only) — it auto-fixes and reports whatever remains. Prefer it over hand-fixing errors one at a time.

Lint enforces single quotes (`avoidEscape: false`, no template literals). Don't write backtick strings in test cases unless you need interpolation — `--fix` can't convert a backtick string that contains a `'`, so you'd have to fix it by hand.

## Autofix

Always try to provide an autofix if it cannot change runtime behavior. If an autofix could change runtime behavior, try to provide a suggestion instead.

Do not complicate autofixes to handle shadowed built-in globals like `Number`, `Math`, `parseInt`, or `parseFloat`. Treat that as unsupported unless the rule already has a simple, local scope-safety check for another reason.

When writing fix functions:

1. **Comments** - Fixes must not remove or relocate comments. If the node being replaced/removed contains comments, either skip the fix (use `abort()`) or use range-aware replacements that preserve them. Check with `sourceCode.getCommentsInside(node)`.
2. **Parentheses** - Replacing `foo` in `foo.bar()` with a complex expression may need wrapping: `(a + b).bar()`.
3. **Semicolons** - If a fix makes a statement start with `[` or `(`, check whether a semicolon is needed before the replacement and prepend `;` if so.
4. **Spacing** - Replacing `{foo}` with an identifier may merge tokens: `const{foo}` becomes `constfoo`. Add spaces when a symbol-boundary becomes a letter-boundary.
5. **Generator fixes** - Use `* fix(fixer) { yield ... }` for multi-step fixes.
6. **Suggestions** - Use `suggest` array with `messageId` and `fix` when autofix could change runtime behavior. Set `hasSuggestions: true` in meta.

## Rule naming

Use a clear prefix that signals intent (see [ESLint built-in rules](https://eslint.org/docs/latest/rules/) for inspiration):

- **`no-`** - Disallow something: `no-array-reduce`, `no-await-in-promise-methods`
- **`prefer-`** - Suggest a better alternative: `prefer-array-flat-map`, `prefer-set-has`
- **`require-`** - Mandate something is present: `require-array-join-separator`
- **`consistent-`** - Enforce a single consistent style: `consistent-destructuring`
- **No prefix** - Enforce a specific pattern: `error-message`, `filename-case`, `throw-new-error`

Name after the target construct, not the fix. Be specific: `no-array-method-this-argument` not `no-this-argument`.

## Creating a new rule

1. Run `npm run create-rule` to scaffold the rule file, test file, and doc file. This also regenerates `rules/index.js` and updates doc headers.
2. Write tests in `test/<rule>.js` before implementing the rule.
3. Implement the rule in `rules/<rule>.js`.
4. Write documentation in `docs/rules/<rule>.md` (below the auto-generated header).
5. Run `node --test --test-update-snapshots test/<rule>.js` to generate snapshots, then `node --test test/<rule>.js` to verify tests pass.
6. Before pushing, run lint (`npm run lint:js`, which runs `eslint` — see [Linting](#linting)), dogfooding (`npm run run-rules-on-codebase`), and then `npm test`. If dogfooding finds intentional internal patterns, disable the rule in `eslint.dogfooding.config.js` instead of adding repo-specific heuristics.

## Commit message format

Follow these conventions:

- **New rule**: `` Add `rule-name` rule ``
- **Fix/improve existing rule**: `` `rule-name`: Short description ``
- **General fix**: `Fix short description`
- **Add option to rule**: `` `rule-name`: Add `optionName` option ``
- **Drop a rule**: `` Drop `rule-name` rule ``

Always use backticks around rule names and option names in commit messages.

# no-conflicting-modifiers

📝 Disallow conflicting test modifiers.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`skip` is exclusive: it wins over every other modifier, expected failure included. `only` combines with `todo` and with expected failure, so those are not reported. Every other pair has a winner that swallows the loser: `skip` beats everything, and `todo` beats expected failure. With `todo`, the expected failure is not dropped outright: the runner still evaluates it and records a mismatch, but the TODO hides it, so a `{todo: true, expectFailure: 'why'}` test whose body passes is recorded as a failing expected failure that the TODO keeps out of the failure count and out of the exit code. With `skip`, the expected failure is dropped entirely: the body never runs, and the result carries only `# SKIP`. Combining incompatible forms through the options object (`{skip: true, only: true}`) or with `expectFailure()` does not combine them: `node:test` silently applies a single one by precedence, so the author's intent is quietly lost. The chained form is not a combination `node:test` supports at all: `test.skip.only` is `undefined`, so such a call throws a `TypeError` while the file loads.

This rule reports a test or suite that has incompatible `only`/`skip`/`todo`/expected-failure forms active at once, across the chained, options-object, and `expectFailure()` forms. A hook has none of these forms: `node:test` reads only `hookType`, `loc`, `parent`, `timeout` and `signal` from a hook's options, so there is nothing on a hook that could conflict. A modifier explicitly set to `false` (for example `{skip: false}`) is treated as inactive, and the same modifier set twice is redundant rather than conflicting. `only` composes with `todo` and with `expectFailure`, since the runner applies each alongside it: a test that is both exclusive-only and a TODO, or both exclusive-only and expected to fail, means what it says.

## Examples

```js
import test, {expectFailure} from 'node:test';

// ❌
test.skip.only('title', () => {});

// ❌
test('title', {skip: true, only: true}, () => {});

// ❌
test('title', {todo: true, expectFailure: 'why'}, () => {});

// ✅
test.skip('title', () => {});

// ✅
test('title', {only: true, expectFailure: true}, () => {});
```

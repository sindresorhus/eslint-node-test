# consistent-modifier-style

📝 Enforce a consistent style for test modifiers.

🚫 This rule is _disabled_ in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

`node:test` lets you mark a test as `only`, `skip`, or `todo` two equivalent ways: a chained modifier (`test.skip('…', fn)`) or a property in the options object (`test('…', {skip: true}, fn)`). Mixing both styles in a codebase is inconsistent. This rule enforces one.

It is off by default. Enable it with the `style` you prefer.

Only `{modifier: true}` is reported under the `chained` style, since a reason string (`{skip: 'why'}`), an explicit `false`, or a dynamic value has no equivalent chained form.

Hooks (`before`, `after`, `beforeEach`, `afterEach`) are always ignored, since they have no chained modifier form in `node:test`.

## Options

- `style` (`'chained'` | `'options'`, default `'chained'`) — which form to require.

```js
{
	'node-test/consistent-modifier-style': ['error', {style: 'chained'}]
}
```

## Examples

With the default `{style: 'chained'}`:

```js
import test from 'node:test';

// ❌
test('t', {skip: true}, () => {});

// ✅
test.skip('t', () => {});
```

With `{style: 'options'}`:

```js
import test from 'node:test';

// ❌
test.skip('t', () => {});

// ✅
test('t', {skip: true}, () => {});
```

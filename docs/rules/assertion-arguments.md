# assertion-arguments

📝 Enforce the correct number of arguments for `node:assert` assertions.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Passing the wrong number of arguments to a `node:assert` assertion silently produces incorrect results. For example, `assert.strictEqual(a)` always passes because the comparison never runs.

Each `node:assert` method has a fixed set of required positional arguments, plus one optional trailing `message` string. This rule reports when:

- Too few required arguments are passed.
- More arguments are passed than the method accepts (required + 1 optional message).
- A trailing `message` argument is statically known to be neither a string nor an `Error`.

Methods with variable arity (`fail`) and calls that use spread arguments are not checked.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.strictEqual(actual);
assert.ok();
assert.deepEqual(a, b, 'message', extra);
assert.ok(value, 42); // message must be a string

// ✅
assert.strictEqual(actual, expected);
assert.ok(value);
assert.deepEqual(a, b, 'message');
```

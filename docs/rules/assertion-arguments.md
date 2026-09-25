# assertion-arguments

📝 Enforce the correct number of arguments for `node:assert` assertions.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Passing too few arguments to a `node:assert` assertion never compares anything: a two-operand method called with one argument throws `ERR_MISSING_ARGS` before the comparison, and `assert.ok()` throws with no value passed, so the failure is a missing-argument type error rather than the assertion's own message. Passing too many is harmless to the comparison, which runs on the arguments the method takes and ignores the rest, but the surplus is almost always a mistake.

Each `node:assert` method has a fixed set of required positional arguments, plus one optional trailing `message` string. This rule reports when:

- Too few required arguments are passed.
- More arguments are passed than the method accepts (required + 1 optional message).
- A trailing `message` argument is statically known to be neither a string, an `Error`, a function, nor `null`.

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

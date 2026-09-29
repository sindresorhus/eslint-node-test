# assertion-arguments

📝 Enforce the correct number of arguments for `node:assert` assertions.

💼 This rule is enabled in the following [configs](https://github.com/sindresorhus/eslint-node-test#preset-configs): ✅ `recommended`, ☑️ `unopinionated`.

<!-- end auto-generated rule header -->
<!-- Do not manually modify this header. Run: `npm run fix:eslint-docs` -->

Passing too few arguments to a `node:assert` assertion never compares anything: a two-operand method called with one argument throws `ERR_MISSING_ARGS` before the comparison, and `assert.ok()` throws `ERR_ASSERTION` with "No value argument passed to `assert.ok()`", so neither reaches a comparison.

Each `node:assert` method has a fixed set of required positional arguments, plus an optional trailing `message`. Since Node 26 the message of `ok()`, `match()`, and the two-operand comparisons may be a [`util.format`](https://nodejs.org/api/util.html#utilformatformat) format string, so substitution arguments may follow it. The `throws()`/`rejects()` family is the exception: it uses the message verbatim and silently drops anything after it, so an argument past the third is a surplus one, and `ifError` ignores everything after its value. This rule reports when:

- Too few required arguments are passed, or more are passed than the `throws()`/`rejects()` family reads.
- A trailing `message` argument is statically known to be neither a string, an `Error`, nor a function. `ok()` and `match()` also accept `null` and an explicit `undefined`, which use the default message; the two-operand comparisons reject both as soon as the assertion fails. `match()` and `doesNotMatch()` fall back to the default message for any falsy message, so any falsy value is accepted there, while a truthy non-string is rejected as everywhere else. The `throws()`/`rejects()` family is different again: `node:assert` never type-checks that message, it is stringified into the failure text.

Methods with variable arity (`fail`) and calls that use spread arguments are not checked.

## Examples

```js
import assert from 'node:assert';

// ❌
assert.strictEqual(actual);
assert.ok();
assert.ok(value, 42); // message must be a string
assert.strictEqual(a, b, null); // the comparisons reject a `null` message

// ✅
assert.strictEqual(actual, expected);
assert.ok(value);
assert.deepEqual(a, b, 'message');
assert.ok(value, 'expected %s to be truthy', label);
```

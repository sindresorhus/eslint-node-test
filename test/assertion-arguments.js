import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

// Helper: wrap code in a basic test file with assert imported.
const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		// Not a node:assert file — ignored
		'assert.strictEqual(a, b);',

		// Ok — 1 required arg
		withAssert('assert.ok(value);'),
		withAssert('assert(value);'),
		withAssert('assert.strict(value);'),
		withAssert('assert.ok(value, "message");'),

		// Equal / strictEqual / notEqual / notStrictEqual — 2 required args
		withAssert('assert.equal(a, b);'),
		withAssert('assert.strictEqual(a, b);'),
		withAssert('assert.notEqual(a, b);'),
		withAssert('assert.notStrictEqual(a, b);'),
		withAssert('assert.strictEqual(a, b, "message");'),

		// DeepEqual / deepStrictEqual / notDeepEqual / notDeepStrictEqual — 2 required
		withAssert('assert.deepEqual(a, b);'),
		withAssert('assert.deepStrictEqual(a, b);'),
		withAssert('assert.notDeepEqual(a, b);'),
		withAssert('assert.notDeepStrictEqual(a, b);'),

		// Match / doesNotMatch — 2 required
		withAssert('assert.match(str, /re/);'),
		withAssert('assert.doesNotMatch(str, /re/);'),

		// Throws / doesNotThrow / rejects / doesNotReject — 1 required, up to 3 args
		withAssert('assert.throws(fn);'),
		withAssert('assert.throws(fn, Error);'),
		withAssert('assert.throws(fn, Error, "message");'),
		withAssert('assert.doesNotThrow(fn);'),
		withAssert('assert.rejects(promise);'),
		withAssert('assert.doesNotReject(promise);'),

		// IfError — 1 required
		withAssert('assert.ifError(value);'),

		// Snapshot — not a node:assert method; its optional second argument is an options object, not checked
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.snapshot(value); });',
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.snapshot(value, {serializers: [fn]}); });',

		// Named imports
		withNamedImport('strictEqual', 'strictEqual(a, b);'),
		withNamedImport('ok', 'ok(value);'),
		withNamedImport('ok', 'ok(value, "message");'),
		withNamedImport('strict as strictAssert', 'strictAssert(value);'),

		// Node:assert/strict
		withStrictAssert('assert.strictEqual(a, b);'),

		// Fail — not checked (variable arity)
		withAssert('assert.fail();'),
		withAssert('assert.fail("message");'),

		// Unknown methods — not checked
		withAssert('assert.unknownMethod(a, b, c, d, e);'),

		// Spread arguments — cannot statically count args, skip
		withAssert('assert.strictEqual(...args);'),
		withAssert('assert.ok(...args);'),

		// T.assert — correct usage
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.strictEqual(a, b); });',
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.ok(value); });',

		// Non-identifier receiver before `.assert` — not a test-context assertion, so not arg-count checked
		'import test from \'node:test\';\ntest(\'t\', t => { this.assert.strictEqual(a); });',
		'import test from \'node:test\';\ntest(\'t\', t => { foo().assert.strictEqual(a); });',

		// Message arg as identifier — cannot statically check type, allowed
		withAssert('assert.ok(value, someVar);'),
		withAssert('assert.strictEqual(a, b, someVar);'),

		// Message arg as member expression — allowed
		withAssert('assert.ok(value, err.message);'),

		// Message arg as an `Error` instance — allowed (node:assert accepts string | Error)
		withAssert('assert.ok(value, new Error("boom"));'),
		withAssert('assert.strictEqual(a, b, new TypeError("nope"));'),

		// Message arg as a conditional/logical expression that can resolve to a string — allowed
		withAssert('assert.ok(value, cond ? "a" : "b");'),
		withAssert('assert.ok(value, message || "default");'),
		withAssert('assert.ok(value, "got " + actual);'),

		// TypeScript
		{
			code: withAssert('assert.strictEqual(a as string, b);'),
			languageOptions: {parser: parsers.typescript},
		},
		// Message arg as a TypeScript cast — allowed (resolves to string | Error)
		{
			code: withAssert('assert.ok(value, message as string);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.ok(value, error as Error);'),
			languageOptions: {parser: parsers.typescript},
		},
	],
	invalid: [
		// Ok — too few
		withAssert('assert.ok();'),
		// Ok — too many
		withAssert('assert.ok(value, "message", extra);'),

		// Bare assert — too few
		withAssert('assert();'),
		withAssert('assert.strict();'),
		withNamedImport('strict as strictAssert', 'strictAssert();'),

		// Equal — too few
		withAssert('assert.equal(a);'),
		// Equal — too many
		withAssert('assert.equal(a, b, "message", extra);'),

		// StrictEqual — too few
		withAssert('assert.strictEqual(a);'),
		// StrictEqual — too many
		withAssert('assert.strictEqual(a, b, "message", extra);'),

		// NotEqual
		withAssert('assert.notEqual(a);'),
		withAssert('assert.notEqual(a, b, "msg", extra);'),

		// NotStrictEqual
		withAssert('assert.notStrictEqual(a);'),

		// DeepEqual
		withAssert('assert.deepEqual(a);'),
		withAssert('assert.deepEqual(a, b, "msg", extra);'),

		// DeepStrictEqual
		withAssert('assert.deepStrictEqual(a);'),

		// NotDeepEqual / notDeepStrictEqual
		withAssert('assert.notDeepEqual(a);'),
		withAssert('assert.notDeepStrictEqual(a);'),

		// Match — too few
		withAssert('assert.match(str);'),
		// DoesNotMatch — too few
		withAssert('assert.doesNotMatch(str);'),

		// Throws/doesNotThrow/rejects/doesNotReject — too few
		withAssert('assert.throws();'),
		withAssert('assert.doesNotThrow();'),
		withAssert('assert.rejects();'),
		withAssert('assert.doesNotReject();'),

		// Throws — too many
		withAssert('assert.throws(fn, Error, "message", extra);'),

		// IfError — too few
		withAssert('assert.ifError();'),
		// IfError — too many (it takes exactly one argument, no trailing message)
		withAssert('assert.ifError(value, "msg");'),
		withAssert('assert.ifError(value, "msg", extra);'),

		// Message arg not a string
		withAssert('assert.ok(value, 123);'),
		withAssert('assert.strictEqual(a, b, false);'),
		withAssert('assert.ok(value, null);'),
		// Message arg as an object/array/function literal — statically not a string or Error
		withAssert('assert.ok(value, {message: "x"});'),
		withAssert('assert.ok(value, [1, 2]);'),
		withAssert('assert.ok(value, () => "x");'),

		// Named imports
		withNamedImport('strictEqual', 'strictEqual(a);'),
		withNamedImport('ok', 'ok();'),

		// Node:assert/strict
		withStrictAssert('assert.strictEqual(a);'),

		// T.assert
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.strictEqual(a); });',

		// TypeScript
		{
			code: withAssert('assert.ok();'),
			languageOptions: {parser: parsers.typescript},
		},
	],
});

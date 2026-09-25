import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

// Helper: wrap code in a basic test file with assert imported.
const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		withAssert('assert.partialDeepStrictEqual(actual, expected);'),
		withAssert('assert.partialDeepStrictEqual(actual, expected, message);'),

		// `ifError` only throws for a value that is neither `null` nor `undefined`, so a missing
		// argument passes just like `ifError(undefined)`
		withAssert('assert.ifError();'),
		withAssert('assert.ifError(undefined);'),
		withAssert('assert.ifError(null);'),

		// `ifError` has no message argument, so its one argument is a value and is never message-checked
		withAssert('assert.ifError(0);'),
		withAssert('assert.ifError(false);'),
		withAssert('assert.ifError(/re/);'),
		withAssert('assert.ifError({});'),
		withAssert('assert.ifError([]);'),
		withNamedImport('ifError', 'ifError(0);'),
		withStrictAssert('assert.ifError(0);'),
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.ifError(0); });',

		// Not a node:assert file — ignored
		'assert.strictEqual(a, b);',

		// Shadowed assert imports are ignored
		withAssert('function run(assert) {\n\tassert.strictEqual(a);\n}'),
		withNamedImport('strictEqual', 'function run(strictEqual) {\n\tstrictEqual(a);\n}'),

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

		// A message may be followed by printf-style substitution arguments, and `ifError` ignores
		// everything after its value, so extra arguments are never an arity error
		withAssert('assert.ok(value, "message %s", extra);'),
		withAssert('assert.ok(value, "message", extra, more, andMore);'),
		withAssert('assert.equal(a, b, "message", extra);'),
		withAssert('assert.strictEqual(a, b, "message", extra);'),
		withAssert('assert.notEqual(a, b, "msg", extra);'),
		withAssert('assert.deepEqual(a, b, "msg", extra);'),
		withAssert('assert.deepStrictEqual(a, b, "msg", extra);'),
		withAssert('assert.notDeepStrictEqual(a, b, "msg", extra);'),
		withAssert('assert.partialDeepStrictEqual(a, b, "msg", extra);'),
		withAssert('assert.match(str, /re/, "msg", extra);'),
		withAssert('assert.doesNotMatch(str, /re/, "msg", extra);'),
		withAssert('assert.throws(fn, Error, "message", extra);'),
		withAssert('assert.doesNotThrow(fn, "message", extra);'),
		withAssert('assert.ifError(value, "msg");'),
		withAssert('assert.ifError(value, "msg", extra);'),
		withNamedImport('ok', 'ok(value, "message", extra);'),
		withStrictAssert('assert.ok(value, "message", extra);'),
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.ok(value, "message", extra); });',

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
		{
			code: 'import type assert from \'node:assert\';\nassert.strictEqual(a);',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import {type strictEqual} from \'node:assert\';\nstrictEqual(a);',
			languageOptions: {parser: parsers.typescript},
		},

		// `.assert.*` on a non-context object — not a node:assert binding
		'import test from \'node:test\';\nconst obj = {assert: {strictEqual() {}}};\ntest(\'t\', () => { obj.assert.strictEqual(a); });',
		// A function message is called to produce the message, and `null` uses the default message
		withAssert('assert.ok(value, () => "x");'),
		withAssert('assert.ok(value, null);'),
	],
	invalid: [
		// A destructured `assert` is a real assertion, exactly like `t.assert`
		'import test from \'node:test\';\ntest(\'x\', ({assert}) => { assert.strictEqual(1); });',
		'import test from \'node:test\';\ntest(\'x\', ({assert: {ok}}) => { ok(); });',

		// The object form still gets a real test context
		'import test from \'node:test\';\ntest({name: \'x\', fn(t) { t.assert.strictEqual(1); }});',

		// Ok — too few
		withAssert('assert.ok();'),

		// Bare assert — too few
		withAssert('assert();'),
		withNamedImport('default as assert', 'assert.strictEqual(a);'),
		withAssert('assert.strict();'),
		withNamedImport('strict as strictAssert', 'strictAssert();'),

		// Equal — too few
		withAssert('assert.equal(a);'),

		// StrictEqual — too few
		withAssert('assert.strictEqual(a);'),
		{
			code: withAssert('(assert as typeof assert).strictEqual(a);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withNamedImport('strictEqual', '(strictEqual as typeof strictEqual)(a);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('(assert as typeof assert).strict.equal(a);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import test from \'node:test\';\ntest(\'t\', t => { (t as TestContext).assert.strictEqual(a); });',
			languageOptions: {parser: parsers.typescript},
		},

		// NotEqual
		withAssert('assert.notEqual(a);'),

		// NotStrictEqual
		withAssert('assert.notStrictEqual(a);'),

		// DeepEqual
		withAssert('assert.deepEqual(a);'),

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

		// Message arg not a string
		withAssert('assert.ok(value, 123);'),
		withAssert('assert.strictEqual(a, b, false);'),
		// Message arg as an object/array literal — statically not a string, Error, or function
		withAssert('assert.ok(value, {message: "x"});'),
		withAssert('assert.ok(value, [1, 2]);'),

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

import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import assert from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		// A getter read through a computed key, or declared with one, runs on every read
		'import assert from \'node:assert\';\nlet n = 0;\nconst o = {get value() { return n++; }};\nassert.strictEqual(o[\'value\'], o[\'value\']);',
		'import assert from \'node:assert\';\nlet n = 0;\nconst o = {get [\'value\']() { return n++; }};\nassert.strictEqual(o.value, o.value);',
		'import assert from \'node:assert\';\nlet n = 0;\nconst o = {get [`value`]() { return n++; }};\nassert.strictEqual(o.value, o.value);',
		'import assert from \'node:assert\';\nclass C { get [\'value\']() { return Math.random(); } }\nconst c = new C();\nassert.strictEqual(c.value, c.value);',
		// An optional chain or a TypeScript wrapper around the read is still the same property read
		'import assert from \'node:assert\';\nlet n = 0;\nconst o = {get value() { return n++; }};\nassert.strictEqual(o?.value, o?.value);',
		'import assert from \'node:assert\';\nlet n = 0;\nconst o = {get value() { return n++; }};\nassert.strictEqual(o?.[\'value\'], o?.[\'value\']);',
		{
			code: 'import assert from \'node:assert\';\nlet n = 0;\nconst o = {get value() { return n++; }};\nassert.strictEqual((o as any).value, (o as any).value);',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: 'import assert from \'node:assert\';\nlet n = 0;\nconst o = {get value() { return n++; }};\nassert.strictEqual(o?.value!, o?.value!);',
			languageOptions: {parser: parsers.typescript},
		},

		// A getter runs on every read, so the two operands are not the same value. This is the
		// property-read equivalent of the rule already skipping operands that contain a call.
		withImport('let n = 0;\nconst counter = {get value() { return n++; }};\nassert.notStrictEqual(counter.value, counter.value);'),
		withImport('let n = 0;\nconst counter = {get value() { return n++; }};\nassert.strictEqual(counter.value, counter.value);'),

		// `a.b` throws when `a` is nullish while `a?.b` yields `undefined`, so the two do not
		// reference the same value
		withImport('assert.equal(a.b, a?.b);'),
		withImport('assert.equal(a?.b, a.b);'),
		withImport('assert.equal(a.b.c, a?.b.c);'),
		withImport('assert.equal(this.x, this?.x);'),
		withImport('assert.notEqual(a.b, a?.b);'),
		withImport('let n = 0;\nclass Counter { get value() { return n++; } }\nconst counter = new Counter();\nassert.notStrictEqual(counter.value, counter.value);'),
		withImport('let n = 0;\nclass Counter { get value() { return n++; } }\nassert.notStrictEqual(new Counter().value, new Counter().value);'),
		// Not an assert file
		'strictEqual(x, x);',

		// Different operands
		withImport('assert.strictEqual(actual, expected);'),
		withImport('assert.deepStrictEqual(a, b);'),

		// Single-operand assertion
		withImport('assert.ok(x);'),
		withImport('assert(x);'),

		// Calls are not treated as the same reference (determinism check)
		withImport('assert.strictEqual(getValue(), getValue());'),
		withImport('assert.deepStrictEqual(a.read(), a.read());'),

		// Different members of the same object
		withImport('assert.strictEqual(obj.a, obj.b);'),

		// `.assert.*` on a non-context object — not a test context
		'import test from \'node:test\';\ntest(\'t\', () => { const db = makeDb(); db.assert.equal(x, x); });',
		// Two separate `RegExp` literals are distinct objects, so a reference comparison of them
		// is not the 'always passes / always fails' case the rule reports.
		withImport('assert.strictEqual(/a/, /a/);'),
		withImport('assert.equal(/a/, /a/);'),
		withImport('assert.notStrictEqual(/a/, /a/);'),
		withImport('assert.notEqual(/a/, /a/);'),

		// A spread argument is not statically known, so it is never a pair of identical operands
		withImport('assert.strictEqual(...args);'),
		withImport('assert.notStrictEqual(x, ...args);'),

		// A class expression is a class to the receiver just like a class declaration
		withImport('let n = 0;\nconst Counter = class { get value() { return n++; } };\nconst counter = new Counter();\nassert.strictEqual(counter.value, counter.value);'),

		// `.assert.*` on `this` is not a test context either
		withImport('function f() {\n\tthis.assert.equal(x, x);\n}'),

		// A getter runs on every read, so the negated form is decided too
		'import assert from \'node:assert\';\nlet n = 0;\nconst o = {get value() { return n++; }};\nassert.notStrictEqual(o.value, o.value);',
	],
	invalid: [
		// A declaration with no initializer is a plain variable, so the two reads are the same reference
		'import assert from \'node:assert\';\nlet a;\nassert.strictEqual(a.b, a.b);',
		'import assert from \'node:assert\';\nvar a;\nassert.deepStrictEqual(a.b, a.b);',
		'import assert from \'node:assert\';\nlet a, other;\nassert.strictEqual(a.b, a.b);',

		// A destructured `assert` is a real assertion, exactly like `t.assert`
		'import test from \'node:test\';\ntest(\'x\', ({assert}) => { assert.strictEqual(a, a); });',
		'import test from \'node:test\';\ntest(\'x\', ({assert: {notStrictEqual}}) => { notStrictEqual(a, a); });',

		// A plain data property is a stable read, so this one is still a real mistake
		withImport('const counter = {value: 1};\nassert.strictEqual(counter.value, counter.value);'),
		// A setter is not a getter; reading the property twice still yields the same value
		withImport('const counter = {set value(v) {}};\nassert.strictEqual(counter.value, counter.value);'),

		// Identical identifiers — always passes
		withImport('assert.strictEqual(x, x);'),
		withImport('assert.equal(x, x);'),
		withImport('assert.deepStrictEqual(value, value);'),

		// Identical member expressions
		withImport('assert.strictEqual(obj.a, obj.a);'),

		// Negated — always fails
		withImport('assert.notStrictEqual(x, x);'),
		withImport('assert.notDeepEqual(obj.a, obj.a);'),

		// With a message argument
		withImport('assert.strictEqual(x, x, "should match");'),

		// Named import
		'import {strictEqual} from \'node:assert\';\nstrictEqual(x, x);',

		// Test context assertion
		'import test from \'node:test\';\ntest("x", t => { t.assert.strictEqual(value, value); });',

		// Parenthesized operand
		withImport('assert.strictEqual((x), x);'),

		// Namespace import
		'import * as assert from \'node:assert\';\nassert.strictEqual(x, x);',

		// TypeScript — wrappers stripped before comparison
		{
			code: withImport('assert.strictEqual(x as Foo, x);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withImport('assert.strictEqual(x!, x!);'),
			languageOptions: {parser: parsers.typescript},
		},
		// The strict view of the imported module is the same assertion
		withImport('assert.strict.deepStrictEqual(x, x);'),
		// A `getTestContext()` receiver is a test context
		'import {getTestContext} from \'node:test\';\ngetTestContext().assert.strictEqual(x, x);',
		// Named import of a negated method
		'import {notStrictEqual} from \'node:assert\';\nnotStrictEqual(x, x);',
		// Two identical literals are the same value too
		withImport('assert.strictEqual(1, 1);'),
		// And the positive deep method is an always-passes check as well
		withImport('assert.deepEqual(x, x);'),
		// The deep methods compare structure, where two identical patterns are the same value.
		withImport('assert.deepStrictEqual(/a/, /a/);'),
		withImport('assert.deepEqual(/a/, /a/);'),
		withImport('assert.notDeepStrictEqual(/a/, /a/);'),
		withImport('assert.notDeepEqual(/a/, /a/);'),
		// `partialDeepStrictEqual` compares the same reference to itself, so it always passes
		withImport('const x = [1];\nassert.partialDeepStrictEqual(x, x);'),

	],
});

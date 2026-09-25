import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withImport = code => `import assert from 'node:assert';\n${code}`;

test.snapshot({
	valid: [
		// A getter runs on every read, so the two operands are not the same value. This is the
		// property-read equivalent of the rule already skipping operands that contain a call.
		withImport('let n = 0;\nconst counter = {get value() { return n++; }};\nassert.notStrictEqual(counter.value, counter.value);'),
		withImport('let n = 0;\nconst counter = {get value() { return n++; }};\nassert.strictEqual(counter.value, counter.value);'),
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
	],
	invalid: [
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
		// The deep methods compare structure, where two identical patterns are the same value.
		withImport('assert.deepStrictEqual(/a/, /a/);'),
		withImport('assert.deepEqual(/a/, /a/);'),
		withImport('assert.notDeepStrictEqual(/a/, /a/);'),
		withImport('assert.notDeepEqual(/a/, /a/);'),
	],
});

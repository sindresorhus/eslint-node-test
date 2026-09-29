import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const withAssert = code => `import assert from 'node:assert';\n${code}`;
const withStrictAssert = code => `import assert from 'node:assert/strict';\n${code}`;
const withNamedImport = (methods, code) => `import {${methods}} from 'node:assert';\n${code}`;
const withNamedStrictImport = (methods, code) => `import {${methods}} from 'node:assert/strict';\n${code}`;
const withTest = code => `import test from 'node:test';\n${code}`;

test.snapshot({
	valid: [
		// Not an assert import — ignored
		'assert.ok(a === b);',

		// No comparison argument
		withAssert('assert.ok(value);'),
		withAssert('assert(value);'),

		// Logical/other operators — not an equality comparison
		withAssert('assert.ok(a && b);'),
		withAssert('assert.ok(a || b);'),

		// Relational comparisons have no `node:assert` equivalent
		withAssert('assert.ok(a > b);'),
		withAssert('assert.ok(a < b);'),
		withAssert('assert.ok(a >= b);'),
		withAssert('assert.ok(a <= b);'),

		// Already an equality assertion
		withAssert('assert.strictEqual(a, b);'),
		withAssert('assert.equal(a, b);'),

		// Negated comparison is not a bare comparison argument
		withAssert('assert.ok(!(a === b));'),

		// Loose comparisons in strict assert namespaces have no semantics-preserving equality assertion
		withStrictAssert('assert.ok(a == b);'),
		withNamedStrictImport('ok', 'ok(a != b);'),
		withAssert('assert.strict.ok(a == b);'),
		withAssert('assert.strict(a == b);'),
		withNamedImport('strict as strictAssert', 'strictAssert.ok(a != b);'),
		withNamedImport('strict as strictAssert', 'strictAssert(a == b);'),

		// `.assert.ok` on a non-context object — not a test context, so not rewritten
		'import test from \'node:test\';\ntest(\'t\', () => { const db = makeDb(); db.assert.ok(a === b); });',
	],
	invalid: [
		// Bare assert
		withAssert('assert(a === b);'),

		// Assert.ok with each operator
		withAssert('assert.ok(a === b);'),
		withAssert('assert.ok(a !== b);'),
		withAssert('assert.ok(a == b);'),
		withAssert('assert.ok(a != b);'),

		// With a message argument — preserved
		withAssert('assert.ok(a === b, "should match");'),

		// Complex operands
		withAssert('assert.ok(foo() === bar.baz);'),
		withAssert('assert.ok(left === right === third);'),

		// Named import
		withNamedImport('ok', 'ok(a === b);'),

		// T.assert.ok
		withTest('test(\'t\', t => { t.assert.ok(a === b); });'),

		// Strict assert namespaces with strict operators
		withAssert('assert.strict.ok(a === b);'),
		withAssert('assert.strict(a !== b);'),
		withNamedImport('strict as strictAssert', 'strictAssert.ok(a !== b);'),
		withNamedImport('strict as strictAssert', 'strictAssert(a === b);'),

		// Parenthesized comparison — reported without a fix
		withAssert('assert.ok((a === b));'),

		// Comment inside the comparison — reported without a fix
		withAssert('assert.ok(a === /* note */ b);'),

		// A TypeScript wrapper on the callee: the fix rewrites the callee inside the wrapper
		{
			code: withAssert('assert!(a === b);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('assert.ok!(a === b);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('(assert as any)(a === b);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('(assert satisfies any)(a !== b);'),
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: withAssert('(<typeof assert>assert)(a === b);'),
			languageOptions: {parser: parsers.typescript},
		},
		// A bare named import cannot be rewritten to an unimported `strictEqual`, wrapper or not
		{
			code: withNamedImport('ok', 'ok!(a === b);'),
			languageOptions: {parser: parsers.typescript},
		},

		// TypeScript
		{
			code: withAssert('assert.ok((a as number) === b);'),
			languageOptions: {parser: parsers.typescript},
		},
		// TypeScript cast around the whole comparison — reported, but no fix (the parenthesized
		// comparison inside the cast would be mangled by the argument split)
		{
			code: withAssert('assert.ok((a === b) as boolean);'),
			languageOptions: {parser: parsers.typescript},
		},
		// `===` treats `0 === -0` as true and `NaN === NaN` as false, but `strictEqual` is `Object.is` (which differ on `NaN` and `±0`), so these are reported without a fix.
		withAssert('assert.ok(x === 0);'),
		withAssert('assert.ok(NaN === NaN);'),
		withAssert('assert.ok(x === -0);'),
		withAssert('assert.ok(x !== 0);'),
		withAssert('assert.ok(diff === -0.0);'),
		withAssert('assert.ok(diff === +0);'),
		// A signed non-zero literal is an ordinary number: `===` and `Object.is` agree on it, so the rewrite is safe. Only `±0` (and `NaN`) differ.
		withAssert('assert.ok(diff === -1);'),
		withAssert('assert.ok(diff === +5);'),
		withAssert('assert.ok(diff === -1.5);'),
		withAssert('assert.ok(diff === -0x10);'),
		withAssert('assert.ok(diff === - 1);'),
		withAssert('assert.ok(diff !== +1e3);'),
		// `equal`/`notEqual` treat `NaN` as equal to itself while `==`/`!=` do not, so the loose rewrite is only reported when a `NaN` operand is present.
		withAssert('assert.ok(NaN == NaN);'),
		withAssert('assert.ok(NaN != NaN);'),
		withAssert('assert.ok(Number("x") == NaN);'),
		withAssert('assert.ok(0 / 0 != NaN);'),
		// One `NaN` operand is enough: the other side may be `NaN` at runtime, where `a == NaN` is false but `equal(a, NaN)` passes.
		withAssert('assert.ok(a == NaN);'),
		withAssert('assert.ok(NaN != a);'),
		withAssert('assert.ok(value == Number(input));'),
		// A binding that is never reassigned is read through its initializer, like the literal it holds
		withAssert('const n = NaN;\nassert.ok(n == n);'),
		withAssert('const expected = 0;\nassert.ok(Math.round(-0.4) === expected);'),
		withAssert('const expected = -0;\nassert.ok(value !== expected);'),
		// A binding that is reassigned, destructured, or holds anything else is left to the runtime, and is fixed
		withAssert('let expected = 0;\nexpected = 1;\nassert.ok(value === expected);'),
		withAssert('const [expected] = [0];\nassert.ok(value === expected);'),
		withAssert('const expected = 1;\nassert.ok(value === expected);'),
		// `Number.NaN`, `Number.parseInt` and `Number.parseFloat` are read like their global counterparts
		withAssert('assert.ok(value !== Number.NaN);'),
		withAssert('assert.ok(value == Number.NaN);'),
		withAssert('assert.ok(Number.parseInt(input) === expected);'),
		withAssert('assert.ok(Number.parseFloat(input) != expected);'),
		// A computed member is left to the runtime, and is fixed
		withAssert('assert.ok(value === Number[key]);'),
	],
});

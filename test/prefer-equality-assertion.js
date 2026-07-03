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
	],
});

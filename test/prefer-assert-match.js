import {getTester, parsers} from './utils/test.js';

const {test} = getTester(import.meta);

const ASSERT_IMPORT = 'import assert from \'node:assert\';';
const STRICT_ASSERT_IMPORT = 'import assert from \'node:assert/strict\';';
const NAMED_IMPORT = 'import {ok, strictEqual, match} from \'node:assert\';';

test.snapshot({
	valid: [
		// Not an assert file — no import
		String.raw`/\d+/.test("foo");`,
		String.raw`"foo".match(/\d+/);`,
		String.raw`assert.ok(/\d+/.test("foo"));`,

		// Already using assert.match / assert.doesNotMatch
		`${ASSERT_IMPORT}\nassert.match('foo', /\\d+/);`,
		`${ASSERT_IMPORT}\nassert.doesNotMatch('foo', /\\d+/);`,

		// Assert.ok with non-regex argument
		`${ASSERT_IMPORT}\nassert.ok(someBoolean);`,
		`${ASSERT_IMPORT}\nassert.ok(foo.test);`,

		// .test() on non-regex (we don't know if it's a RegExp)
		`${ASSERT_IMPORT}\nassert.ok(foo.test("bar"));`,

		// .match() with non-regex argument
		`${ASSERT_IMPORT}\nassert.ok(str.match(someVar));`,

		// Assert.strictEqual with non-boolean second arg
		`${ASSERT_IMPORT}\nassert.strictEqual(/\\d+/.test(str), 1);`,
		`${ASSERT_IMPORT}\nassert.strictEqual(/\\d+/.test(str), str);`,

		// Assert.strictEqual with both regex — not applicable
		`${ASSERT_IMPORT}\nassert.strictEqual(/\\d+/.test(str), /\\w+/.test(str));`,

		// Re.test() missing argument — can't transform safely
		`${ASSERT_IMPORT}\nassert.ok(/\\d+/.test());`,

		// Str.match() missing argument
		`${ASSERT_IMPORT}\nassert.ok(str.match());`,

		// `String#search` returns an index, not a boolean — incompatible polarity, so not rewritten
		`${ASSERT_IMPORT}\nassert.ok(str.search(/\\d+/));`,

		// Other assertion methods that don't match
		`${ASSERT_IMPORT}\nassert.deepStrictEqual(/\\d+/.test(str), true);`,

		// Named import: named `ok` used — it's matched, but we cover that below in invalid
		// Intentionally valid: `assert.notEqual` when comparing non-boolean
		`${ASSERT_IMPORT}\nassert.notStrictEqual(/\\d+/.test(str), 1);`,
	],
	invalid: [
		// Comment inside the call — reported but not autofixed (the fix would drop the comment)
		`${ASSERT_IMPORT}\nassert.strictEqual(/\\d+/.test('foo'), /* keep */ true);`,

		// Parenthesized argument — reported but not autofixed (the parens would wrap a comma expression)
		`${ASSERT_IMPORT}\nassert.ok((/\\d+/.test('foo')));`,
		`${ASSERT_IMPORT}\nassert.strictEqual((/\\d+/.test('foo')), true);`,

		// Assert.ok(re.test(str))
		`${ASSERT_IMPORT}\nassert.ok(/\\d+/.test('foo'));`,
		`${ASSERT_IMPORT}\nassert.ok(new RegExp('\\\\d+').test('foo'));`,

		// Assert.ok(!re.test(str))
		`${ASSERT_IMPORT}\nassert.ok(!/\\d+/.test('foo'));`,

		// Assert.ok(str.match(re))
		`${ASSERT_IMPORT}\nassert.ok('foo'.match(/\\d+/));`,

		// Assert.ok(!str.match(re)) — negated `String#match`
		`${ASSERT_IMPORT}\nassert.ok(!'foo'.match(/\\d+/));`,

		// Assert.strictEqual(re.test(str), true)
		`${ASSERT_IMPORT}\nassert.strictEqual(/\\d+/.test('foo'), true);`,
		`${ASSERT_IMPORT}\nassert.strictEqual(/\\d+/.test('foo'), false);`,

		// Assert.strictEqual(true, re.test(str)) — reversed
		`${ASSERT_IMPORT}\nassert.strictEqual(true, /\\d+/.test('foo'));`,
		`${ASSERT_IMPORT}\nassert.strictEqual(false, /\\d+/.test('foo'));`,

		// Assert.equal
		`${ASSERT_IMPORT}\nassert.equal(/\\d+/.test('foo'), true);`,

		// Assert.notStrictEqual
		`${ASSERT_IMPORT}\nassert.notStrictEqual(/\\d+/.test('foo'), true);`,
		`${ASSERT_IMPORT}\nassert.notStrictEqual(/\\d+/.test('foo'), false);`,

		// Assert.notEqual
		`${ASSERT_IMPORT}\nassert.notEqual(/\\d+/.test('foo'), true);`,

		// Assert.notStrictEqual reversed — `notStrictEqual(true, re.test(str))`
		`${ASSERT_IMPORT}\nassert.notStrictEqual(true, /\\d+/.test('foo'));`,
		`${ASSERT_IMPORT}\nassert.notEqual(false, /\\d+/.test('foo'));`,

		// Named import: `ok`
		`${NAMED_IMPORT}\nok(/\\d+/.test('foo'));`,

		// T.assert.match pattern
		'import test from \'node:test\';\nimport assert from \'node:assert\';\ntest(\'t\', t => { t.assert.ok(/\\d+/.test(\'foo\')); });',

		// `t.assert.ok` in a test file WITHOUT a `node:assert` import — caught via test-file activation
		'import test from \'node:test\';\ntest(\'t\', t => { t.assert.ok(/\\d+/.test(\'foo\')); });',

		// Assert/strict module
		`${STRICT_ASSERT_IMPORT}\nassert.ok(/\\d+/.test('foo'));`,

		// TypeScript
		{
			code: `${ASSERT_IMPORT}\nassert.ok(/\\d+/.test('foo' as string));`,
			languageOptions: {parser: parsers.typescript},
		},

		// RegExp constructor
		`${ASSERT_IMPORT}\nassert.ok(new RegExp('^foo').test('foobar'));`,
		`${ASSERT_IMPORT}\nassert.ok(RegExp('^foo').test('foobar'));`,
	],
});

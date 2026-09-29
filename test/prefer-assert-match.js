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

		// `String#match` returns `Array | null`, never a boolean, so comparing it to a boolean
		// literal is always false — a user bug the rule must not silently "fix" to a passing match.
		`${ASSERT_IMPORT}\nassert.strictEqual('foo'.match(/\\d+/), true);`,
		`${ASSERT_IMPORT}\nassert.equal('foo'.match(/\\d+/), true);`,
		`${ASSERT_IMPORT}\nassert.notStrictEqual('foo'.match(/\\d+/), true);`,
		`${ASSERT_IMPORT}\nassert.strictEqual(true, 'foo'.match(/\\d+/));`,
		// The guard blocks the `false` polarity too, which would otherwise map to `doesNotMatch`.
		`${ASSERT_IMPORT}\nassert.strictEqual('foo'.match(/\\d+/), false);`,
		// …and the negated methods, whose outcome is unrelated to whether the regex matched.
		`${ASSERT_IMPORT}\nassert.notEqual('foo'.match(/\\d+/), true);`,
		`${ASSERT_IMPORT}\nassert.notStrictEqual('foo'.match(/\\d+/), false);`,

		// Re.test() missing argument — can't transform safely
		`${ASSERT_IMPORT}\nassert.ok(/\\d+/.test());`,

		// Str.match() missing argument
		`${ASSERT_IMPORT}\nassert.ok(str.match());`,

		// A computed member is not read as `.test()`/`.match()`, so there is nothing to rewrite
		`${ASSERT_IMPORT}\nassert.ok(re['test']('foo'));`,
		`${ASSERT_IMPORT}\nassert.ok(str['match'](/\\d+/));`,

		// A spread argument hides the subject, so the call cannot be rewritten
		`${ASSERT_IMPORT}\nassert.ok(re.test(...args));`,
		`${ASSERT_IMPORT}\nassert.ok(str.match(...args));`,

		// Assert.ok() has no argument to inspect
		`${ASSERT_IMPORT}\nassert.ok();`,

		// A second `!` is not a negation of the match result
		`${ASSERT_IMPORT}\nassert.ok(!!/\\d+/.test('foo'));`,

		// The equality forms need both a regex call and a boolean literal
		`${ASSERT_IMPORT}\nassert.strictEqual(/\\d+/.test('foo'));`,

		// `String#search` returns an index, not a boolean — incompatible polarity, so not rewritten
		`${ASSERT_IMPORT}\nassert.ok(str.search(/\\d+/));`,

		// Other assertion methods that don't match
		`${ASSERT_IMPORT}\nassert.deepStrictEqual(/\\d+/.test(str), true);`,

		// Named import: named `ok` used — it's matched, but we cover that below in invalid
		// Intentionally valid: `assert.notEqual` when comparing non-boolean
		`${ASSERT_IMPORT}\nassert.notStrictEqual(/\\d+/.test(str), 1);`,

		// `.assert.ok` on a non-context object — not a test context, so not rewritten
		'import test from \'node:test\';\ntest(\'t\', () => { const db = makeDb(); db.assert.ok(/re/.test(s)); });',
	],
	invalid: [
		// The inner `str`/`regex` are re-emitted with `getText`, which drops the parentheses around a sequence expression, so the problem is reported but the fix is withheld.
		`${ASSERT_IMPORT}\nassert.ok(/^foo/.test((a, b)));`,
		`${ASSERT_IMPORT}\nassert.ok((a, b).match(/^foo/));`,

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

		// Named import: the callee is an identifier, so the assertion method cannot be renamed
		`${NAMED_IMPORT}\nstrictEqual(/\\d+/.test('foo'), true);`,

		// A negation around a parenthesized call: the rewrite replaces the whole argument, so the inner parentheses go with it
		`${ASSERT_IMPORT}\nassert.ok(!(/\\d+/.test('foo')));`,

		// A message argument stays in place after the rewrite
		`${ASSERT_IMPORT}\nassert.ok(/\\d+/.test('foo'), 'should match');`,
		`${ASSERT_IMPORT}\nassert.strictEqual(/\\d+/.test('foo'), true, 'should match');`,

		// `typeof` is the one unary operator that yields a string, so the subject is fixable
		`${ASSERT_IMPORT}\nassert.ok(/a/.test(typeof value));`,

		// Reported but not fixed: `re.test(x)` coerces `x`, while `assert.match(x, re)` throws
		`${ASSERT_IMPORT}\nassert.ok(/a/.test(Infinity));`,
		`${ASSERT_IMPORT}\nassert.ok(/a/.test(function () {}));`,

		// The `false` polarity of the remaining equality methods
		`${ASSERT_IMPORT}\nassert.equal(/\\d+/.test('foo'), false);`,
		`${ASSERT_IMPORT}\nassert.notEqual(/\\d+/.test('foo'), false);`,

		// `assert` destructured off the test context
		'import test from \'node:test\';\ntest(\'t\', ({assert: {ok}}) => { ok(/\\d+/.test(\'foo\')); });',

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

		// Parenthesized boolean argument — reported but not autofixed (parens would be left behind)
		String.raw`${ASSERT_IMPORT}
assert.strictEqual(/\d+/.test('foo'), (true));`,
		// A statically non-string subject is reported but not fixed: `re.test(x)` coerces `x`, while `assert.match(x, re)` throws unless `x` is already a string primitive.
		ASSERT_IMPORT + '\nassert.ok(/5/.test(5));',
		ASSERT_IMPORT + '\nassert.ok(/a/.test(["a"]));',
		// A statically non-string subject (`undefined`, `NaN`, a unary expression, a function) is reported but not fixed: `re.test(x)` coerces `x`, but `assert.match(x, re)` throws.
		ASSERT_IMPORT + '\nassert.ok(/d/.test(undefined));',
		ASSERT_IMPORT + '\nassert.ok(/d/.test(NaN));',
		ASSERT_IMPORT + '\nassert.ok(/d/.test(-0));',
		ASSERT_IMPORT + '\nassert.ok(/d/.test(() => {}));',
		ASSERT_IMPORT + '\nassert.ok(/ell/.test(Buffer.from("hello")));',
		ASSERT_IMPORT + '\nassert.ok(/a/.test(JSON.parse(body)));',
		ASSERT_IMPORT + '\nassert.ok(/class/.test(class Foo {}));',
		ASSERT_IMPORT + '\nassert.ok(/a/.test(value = {}));',
		ASSERT_IMPORT + '\nassert.ok(/a/.test(value = 5));',
		// A plain assignment evaluates to its right side, so one that may be a string is fixed
		ASSERT_IMPORT + '\nassert.ok(/a/.test(value = \'abc\'));',
		ASSERT_IMPORT + '\nassert.ok(/a/.test(value = `abc`));',
		ASSERT_IMPORT + '\nassert.ok(/a/.test(value = other));',
		// A logical assignment may evaluate to the old value instead, so it is not fixed
		ASSERT_IMPORT + '\nassert.ok(/a/.test(value ||= \'abc\'));',
		// An optional chain makes the call return `undefined` for a nullish receiver, so the truthiness form is a nullish check rather than a match, and the rewrite would change it
		ASSERT_IMPORT + '\nassert.ok(str?.match(/a/));',
		ASSERT_IMPORT + '\nassert.ok(/a/.test?.(str));',
		ASSERT_IMPORT + '\nassert.ok(obj?.deep.match(/a/));',
		ASSERT_IMPORT + '\nassert.ok(!str?.match(/a/));',
		// A `?.` anywhere in the chain short-circuits all of it, including one before an intermediate call
		ASSERT_IMPORT + '\nassert.ok(!str?.trim().match(/a/));',
		ASSERT_IMPORT + '\nassert.ok(getString?.().match(/a/));',
		ASSERT_IMPORT + '\nassert.ok(response?.text().match(/a/));',
		// A parenthesized chain ends there, so the call after it is an ordinary call
		ASSERT_IMPORT + '\nassert.ok((str?.trim()).match(/a/));',
		// TypeScript can put a non-null assertion between the call and its chain
		{
			code: ASSERT_IMPORT + '\nassert.ok(str?.match(/a/)!);',
			languageOptions: {parser: parsers.typescript},
		},
		{
			code: ASSERT_IMPORT + '\nassert.ok(str?.trim()!.match(/a/));',
			languageOptions: {parser: parsers.typescript},
		},
		// The rewrite keeps only the subject and the pattern, so an extra argument, which is still evaluated, is reported without a fix
		ASSERT_IMPORT + '\nassert.ok(/a/.test(str, log()));',
		ASSERT_IMPORT + '\nassert.ok(str.match(/a/, log()));',
		ASSERT_IMPORT + '\nassert.strictEqual(/a/.test(str, log()), true);',
	],
});

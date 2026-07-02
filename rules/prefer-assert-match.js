import {resolveImports, parseAssertionCall} from './utils/node-test.js';
import {isRegexLiteral, isBooleanLiteral} from './ast/index.js';
import {isParenthesized} from './utils/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'prefer-assert-match/error';

const messages = {
	[MESSAGE_ID]: 'Prefer `assert.{{method}}()` over asserting `{{pattern}}` results.',
};

/*
Determine whether a node is a RegExp (regex literal or `new RegExp()` / `RegExp()` call).
We deliberately keep this simple: only regex literals and direct constructor calls.
We do not follow variable references to avoid false positives.
*/
function isRegExp(node) {
	if (!node) {
		return false;
	}

	if (isRegexLiteral(node)) {
		return true;
	}

	// `new RegExp(...)` or `RegExp(...)`
	return (node.type === 'NewExpression' || node.type === 'CallExpression')
		&& node.callee.type === 'Identifier'
		&& node.callee.name === 'RegExp';
}

/*
Parse a `re.test(str)` or `str.match(re)` call.
Returns `{regex, string, methodName}` or `undefined`.

`String#search` is intentionally not handled: it returns the match index (`-1` for no match),
so `assert.ok(str.search(re))` is truthy for *no* match and falsy for a match at index `0` —
the opposite polarity of `re.test()` / `str.match()`, so it cannot be rewritten to `assert.match`.
*/
function parseRegexCall(node) {
	if (
		node.type !== 'CallExpression'
		|| node.callee.type !== 'MemberExpression'
		|| node.callee.computed
		|| node.callee.property.type !== 'Identifier'
	) {
		return;
	}

	const {name} = node.callee.property;
	const {object} = node.callee;

	if (name === 'test' && isRegExp(object)) {
		// `re.test(str)` — first arg is the string
		const stringNode = node.arguments[0];
		if (!stringNode || stringNode.type === 'SpreadElement') {
			return;
		}

		return {regex: object, string: stringNode, methodName: 'test'};
	}

	if (name === 'match' && node.arguments.length > 0) {
		// `str.match(re)` — first arg should be the regex
		const regexArgument = node.arguments[0];
		if (!regexArgument || regexArgument.type === 'SpreadElement') {
			return;
		}

		if (!isRegExp(regexArgument)) {
			return;
		}

		return {regex: regexArgument, string: object, methodName: name};
	}
}

/*
Build a fixer that replaces `assert.ok(re.test(str))` → `assert.match(str, re)`.
Handles the callee method rename and the argument rewrite.
*/
function buildFix({node, method, regexNode, stringNode, extraArgsToRemove, sourceCode}) {
	return function * fix(fixer) {
		const assertCallee = node.callee;

		if (
			assertCallee.type === 'MemberExpression'
			&& !assertCallee.computed
			&& assertCallee.property.type === 'Identifier'
		) {
			yield fixer.replaceText(assertCallee.property, method);
		} else {
			// Named import: the callee is an Identifier — we can't rename it without
			// knowing the local name. Just bail on the fix.
			return;
		}

		const regexText = sourceCode.getText(regexNode);
		const stringText = sourceCode.getText(stringNode);
		yield fixer.replaceText(node.arguments[0], `${stringText}, ${regexText}`);

		// Remove any extra arguments (e.g. the boolean literal in strictEqual).
		for (const argument of extraArgsToRemove) {
			const tokenBefore = sourceCode.getTokenBefore(argument, {includeComments: false});
			yield fixer.removeRange([sourceCode.getRange(tokenBefore)[0], sourceCode.getRange(argument)[1]]);
		}
	};
}

/*
Whether the call can be safely rewritten: a member-expression callee (a named import can't be
renamed without knowing the local name), no comments inside the call that the argument
rewrite/removal could drop, and a non-parenthesized first argument (the rewrite replaces the inner
node, so surrounding parentheses would be left wrapping the `str, re` pair as a comma expression).
*/
function canAutofix(node, context) {
	return node.callee.type === 'MemberExpression'
		&& context.sourceCode.getCommentsInside(node).length === 0
		&& !isParenthesized(node.arguments[0], context);
}

/** Build the problem object for a detected regex-result assertion. */
function makeProblem({node, assertMethod, regexCall, extraArgsToRemove, context}) {
	const fix = canAutofix(node, context)
		? buildFix({
			node, method: assertMethod, regexNode: regexCall.regex, stringNode: regexCall.string, extraArgsToRemove, sourceCode: context.sourceCode,
		})
		: undefined;

	return {
		node,
		messageId: MESSAGE_ID,
		data: {method: assertMethod, pattern: `${regexCall.methodName}()`},
		fix,
	};
}

/*
Handle the equality forms `assert.strictEqual`/`equal`/`notStrictEqual`/`notEqual`, where one
argument is `re.test(str)` and the other a boolean literal, in either order.
*/
function getEqualityProblem(node, method, context) {
	if (node.arguments.length < 2) {
		return;
	}

	const [firstArgument, secondArgument] = node.arguments;
	const unwrappedFirst = unwrapTypeScriptExpression(firstArgument);
	const unwrappedSecond = unwrapTypeScriptExpression(secondArgument);

	let regexCall = parseRegexCall(unwrappedFirst);
	let booleanLiteral = unwrappedSecond;
	if (!(regexCall && isBooleanLiteral(booleanLiteral))) {
		regexCall = parseRegexCall(unwrappedSecond);
		booleanLiteral = unwrappedFirst;
		if (!(regexCall && isBooleanLiteral(booleanLiteral))) {
			return;
		}
	}

	const isNegated = method === 'notStrictEqual' || method === 'notEqual';
	// `strictEqual(re.test(str), true)` asserts a match; negating the method or comparing to
	// `false` each flip the meaning.
	const isMatches = (booleanLiteral.value === true) !== isNegated;
	const assertMethod = isMatches ? 'match' : 'doesNotMatch';

	// `buildFix` collapses the two arguments into `str, re` regardless of their original order.
	return makeProblem({
		node, assertMethod, regexCall, extraArgsToRemove: [secondArgument], context,
	});
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);

	if (!imports.isAssertOrTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		const parsed = parseAssertionCall(node, imports);
		if (!parsed) {
			return;
		}

		const {method} = parsed;

		// `assert.ok(re.test(str))` / `assert.ok(str.match(re))`
		// `assert.ok(!re.test(str))` / `assert.ok(!str.match(re))`
		if (method === 'ok') {
			const firstArgument = node.arguments[0];
			if (!firstArgument) {
				return;
			}

			let target = unwrapTypeScriptExpression(firstArgument);
			let assertMethod = 'match';

			// Negated: `assert.ok(!re.test(str))` asserts no match.
			if (target.type === 'UnaryExpression' && target.operator === '!') {
				target = unwrapTypeScriptExpression(target.argument);
				assertMethod = 'doesNotMatch';
			}

			const regexCall = parseRegexCall(target);
			if (!regexCall) {
				return;
			}

			return makeProblem({
				node, assertMethod, regexCall, extraArgsToRemove: [], context,
			});
		}

		// `assert.strictEqual`/`equal`/`notStrictEqual`/`notEqual(re.test(str), true/false)`
		if (['strictEqual', 'equal', 'notStrictEqual', 'notEqual'].includes(method)) {
			return getEqualityProblem(node, method, context);
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer `assert.match()`/`assert.doesNotMatch()` over asserting `RegExp#test()` / `String#match()` results.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

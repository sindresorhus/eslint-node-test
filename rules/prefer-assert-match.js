import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import {isRegexLiteral, isBooleanLiteral, isFunction} from './ast/index.js';
import {isParenthesized, unwrapExpression, isExpressionWrapper} from './utils/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'prefer-assert-match/error';

const messages = {
	[MESSAGE_ID]: 'Prefer `assert.{{method}}()` over asserting `{{pattern}}` results.',
};

const EQUALITY_METHODS = new Set(['strictEqual', 'equal', 'notStrictEqual', 'notEqual']);

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
/*
Whether the call runs through an optional chain, which is what decides whether it can return
`undefined`. A `?.` anywhere in the chain short-circuits all of it (`str?.trim().match(re)`, `getString?.().match(re)`), and the whole chain is one `ChainExpression`, so the question is only whether one wraps the call. TypeScript can put a wrapper between them (`str?.match(re)!`). A parenthesized chain ends at its parentheses, so `(str?.trim()).match(re)` is an ordinary call.
*/
function isInOptionalChain(node) {
	for (let {parent} = node; isExpressionWrapper(parent); parent = parent.parent) {
		if (parent.type === 'ChainExpression') {
			return true;
		}
	}

	return false;
}

function parseRegexCall(node) {
	// An optional chain puts the call inside a `ChainExpression`, which is unwrapped here.
	node = unwrapExpression(node);
	if (
		node.type !== 'CallExpression'
		|| node.callee.type !== 'MemberExpression'
		|| node.callee.computed
		|| node.callee.property.type !== 'Identifier'
	) {
		return;
	}

	// `str?.match(re)` and `re?.test(str)` return `undefined` when the receiver is nullish, so the
	// truthiness form of those is a nullish check rather than a match, and rewriting it would change
	// what the assertion means.
	const isOptional = isInOptionalChain(node);

	const {name} = node.callee.property;
	const {object} = node.callee;

	if (name === 'test' && isRegExp(object)) {
		// `re.test(str)` — first arg is the string
		const stringNode = node.arguments[0];
		if (!stringNode || stringNode.type === 'SpreadElement') {
			return;
		}

		return {
			regex: object, string: stringNode, methodName: 'test', isOptional,
		};
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

		return {
			regex: regexArgument, string: object, methodName: name, isOptional,
		};
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

/** Whether an operand is a sequence expression, whose parentheses are significant. */
function isSequenceExpression(node) {
	return node?.type === 'SequenceExpression';
}

/*
Whether the call can be safely rewritten: a member-expression callee (a named import can't be
renamed without knowing the local name), no comments inside the call that the argument
rewrite/removal could drop, and no parenthesized arguments. The rewrite replaces the first
argument's inner node and removes the boolean argument up to its own inner node, so surrounding
parentheses on either would be left behind as stray tokens.
*/
/*
`re.test(x)` coerces `x` to a string, but `assert.match(x, re)` requires `x` to already be a string
primitive and throws otherwise. When the subject is statically known not to be a string, the rewrite
would turn a passing assertion into a thrown one, so it is reported but not fixed.
*/
/*
Calls whose result is never a string primitive, so a subject built from one is a non-string. Any other
call may return a string, which is left to the runtime like any other unknown expression.
*/
const NON_STRING_CALL_METHODS = new Map([
	['Buffer', new Set(['from', 'alloc', 'concat'])],
	['JSON', new Set(['parse'])],
]);

/** Whether the callee is a call this plugin knows never returns a string primitive. */
function isNonStringCall(callee) {
	if (callee.type !== 'MemberExpression' || callee.computed || callee.object.type !== 'Identifier') {
		return false;
	}

	return NON_STRING_CALL_METHODS.get(callee.object.name)?.has(callee.property.name) ?? false;
}

function isStaticallyNonString(node) {
	node = unwrapTypeScriptExpression(node);
	if (node.type === 'Literal') {
		return typeof node.value !== 'string';
	}

	if (node.type === 'Identifier') {
		return ['NaN', 'Infinity', 'undefined'].includes(node.name);
	}

	// Every unary operator yields a non-string except `typeof`, which yields a string.
	if (node.type === 'UnaryExpression') {
		return node.operator !== 'typeof';
	}

	// An assignment evaluates to its right-hand side.
	if (node.type === 'AssignmentExpression') {
		const right = unwrapTypeScriptExpression(node.right);
		return right.type !== 'Literal' || typeof right.value !== 'string';
	}

	// A class expression is a constructor, never a string.
	if (node.type === 'ClassExpression') {
		return true;
	}

	if (node.type === 'CallExpression' && isNonStringCall(node.callee)) {
		return true;
	}

	return node.type === 'ArrayExpression'
		|| node.type === 'ObjectExpression'
		|| node.type === 'NewExpression'
		|| isFunction(node);
}

function canAutofix(node, context, regexCall) {
	return node.callee.type === 'MemberExpression'
		&& context.sourceCode.getCommentsInside(node).length === 0
		&& node.arguments.every(argument => !isParenthesized(argument, context))
		// The inner `str`/`regex` are re-emitted with `getText`, which drops the parentheses
		// around a sequence expression. Keeping them would leave a stray `)`, but dropping them
		// turns one argument into several, so do not rewrite at all.
		&& !isSequenceExpression(regexCall.string)
		&& !isSequenceExpression(regexCall.regex)
		&& !regexCall.isOptional
		&& !isStaticallyNonString(regexCall.string);
}

/** Build the problem object for a detected regex-result assertion. */
function makeProblem({node, assertMethod, regexCall, extraArgsToRemove, context}) {
	const fix = canAutofix(node, context, regexCall)
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

	// Only `re.test(str)` returns a boolean; `str.match(re)` returns `Array | null`, so comparing it
	// to a boolean literal is always false (a user bug), and rewriting it to `assert.match()` would
	// silently change the assertion's outcome.
	if (regexCall.methodName !== 'test') {
		return;
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

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const parsed = parseSupportedAssertionCall(node, imports, tracker);
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

			let target = unwrapExpression(firstArgument);
			let assertMethod = 'match';

			// Negated: `assert.ok(!re.test(str))` asserts no match.
			if (target.type === 'UnaryExpression' && target.operator === '!') {
				target = unwrapExpression(target.argument);
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
		if (EQUALITY_METHODS.has(method)) {
			return getEqualityProblem(node, method, context);
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
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

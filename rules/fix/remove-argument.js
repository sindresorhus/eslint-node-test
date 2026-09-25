import {isCommaToken} from '@eslint-community/eslint-utils';
import {getParentheses, isExpressionWrapper} from '../utils/index.js';

/**
@import {TSESTree as ESTree} from '@typescript-eslint/types';
@import * as ESLint from 'eslint';
*/

/**
Get the argument as the call holds it, plus the call it belongs to.

An argument can be wrapped in an optional chain or a TypeScript `as`/`satisfies`/`!`, as in
`fn((a as unknown), b)`. The call holds the outermost wrapper, not the inner node, so the range
has to start and end on the wrapper or the leftover `as unknown` would stay behind.
*/
function getArgumentAndCall(node) {
	let argument = node;
	let {parent} = argument;

	while (isExpressionWrapper(parent)) {
		argument = parent;
		parent = argument.parent;
	}

	const isCall = parent?.type === 'CallExpression' || parent?.type === 'NewExpression';
	return isCall ? {argument, call: parent} : undefined;
}

/**
@param {ESTree.CallExpressionArgument} node
@param {ESLint.Rule.RuleContext} context - The ESLint rule context object.
@returns {Array<number>}
*/
function getArgumentRemovalRange(node, context) {
	const resolved = getArgumentAndCall(node);
	if (!resolved) {
		return [0, 0];
	}

	const {argument, call} = resolved;
	const index = call.arguments.indexOf(argument);
	const parentheses = getParentheses(argument, context);
	const firstToken = parentheses[0] || argument;
	const lastToken = parentheses.at(-1) || argument;
	const {sourceCode} = context;

	let [start] = sourceCode.getRange(firstToken);
	let [, end] = sourceCode.getRange(lastToken);

	if (call.arguments.length === 1) {
		// The only argument: also drop a dangling trailing comma if present (`fn(a,)`).
		const tokenAfter = sourceCode.getTokenAfter(lastToken);
		if (isCommaToken(tokenAfter)) {
			[, end] = sourceCode.getRange(tokenAfter);
		}
	} else if (index === 0) {
		// First of several: remove it through the following comma and the gap after it, so
		// `fn(a, b)` becomes `fn(b)` rather than `fn( b)`.
		const commaToken = sourceCode.getTokenAfter(lastToken);
		const nextArgumentToken = sourceCode.getTokenAfter(commaToken);
		[end] = sourceCode.getRange(nextArgumentToken);
	} else {
		// Otherwise remove the comma that precedes it.
		const commaToken = sourceCode.getTokenBefore(firstToken);
		[start] = sourceCode.getRange(commaToken);
	}

	return [start, end];
}

/**
@param {ESLint.Rule.RuleFixer} fixer
@param {ESTree.CallExpressionArgument} node
@param {ESLint.Rule.RuleContext} context - The ESLint rule context object.
@returns {ESLint.Rule.Fix}
*/
export default function removeArgument(fixer, node, context) {
	return fixer.removeRange(getArgumentRemovalRange(node, context));
}

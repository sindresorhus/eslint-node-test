import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseAssertionCall,
	createContextTracker,
	isAssertionCallWithSupportedContext,
} from './utils/node-test.js';
import {isFunction} from './ast/index.js';
import {containsSuspensionPoint, isParenthesized, unwrapTypeScriptExpression} from './utils/index.js';

/**
@import {TSESTree as ESTree} from '@typescript-eslint/types';
@import * as ESLint from 'eslint';
*/

const MESSAGE_ID = 'no-unneeded-async-rejects-callback/error';
const MESSAGE_ID_SUGGESTION = 'no-unneeded-async-rejects-callback/suggestion';
const messages = {
	[MESSAGE_ID]: 'This `rejects()` callback may unnecessarily wrap a single awaited operation.',
	[MESSAGE_ID_SUGGESTION]: 'Replace it with a plain Promise-returning callback.',
};

function getAwaitedCallbackBody(callback) {
	let expression = callback.body;
	let shouldAddReturn = false;
	if (expression.type === 'BlockStatement') {
		if (expression.body.length !== 1) {
			return;
		}

		const [statement] = expression.body;
		if (statement.type === 'ExpressionStatement') {
			expression = statement.expression;
			shouldAddReturn = true;
		} else if (statement.type === 'ReturnStatement' && statement.argument) {
			expression = statement.argument;
		} else {
			return;
		}
	}

	const awaitExpression = unwrapTypeScriptExpression(expression);
	if (awaitExpression.type === 'AwaitExpression') {
		return {awaitExpression, shouldAddReturn};
	}
}

function hasCommentInRange(sourceCode, node, range) {
	return sourceCode.getCommentsInside(node).some(comment => {
		const commentRange = sourceCode.getRange(comment);
		return commentRange[0] >= range[0] && commentRange[1] <= range[1];
	});
}

function isBuiltInPromiseType(type, program, seen = new Set()) {
	if (seen.has(type)) {
		return false;
	}

	seen.add(type);

	if (type.isUnion()) {
		return type.types.every(member => isBuiltInPromiseType(member, program, new Set(seen)));
	}

	if (type.isIntersection() && type.types.some(member => isBuiltInPromiseType(member, program, new Set(seen)))) {
		return true;
	}

	const symbol = type.getSymbol();
	return symbol?.getName() === 'Promise'
		&& symbol.declarations?.some(declaration => program.isSourceFileDefaultLibrary(declaration.getSourceFile())) === true;
}

function hasBuiltInPromiseType(node, parserServices, program) {
	try {
		return isBuiltInPromiseType(parserServices.getTypeAtLocation(node), program);
	} catch {
		return false;
	}
}

function isAsyncFunction(node) {
	return isFunction(node) && node.async && !node.generator;
}

function isKnownAsyncCall(node, sourceCode) {
	node = unwrapTypeScriptExpression(node);
	if (node.type !== 'CallExpression' || node.optional || node.arguments.length > 0) {
		return false;
	}

	const callee = unwrapTypeScriptExpression(node.callee);
	if (isAsyncFunction(callee)) {
		return true;
	}

	if (callee.type !== 'Identifier') {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(callee), callee);
	if (
		variable?.defs.length !== 1
		|| variable.references.some(reference => reference.isWrite() && !reference.init)
	) {
		return false;
	}

	const [definition] = variable.defs;
	return definition.type === 'FunctionName' && isAsyncFunction(definition.node);
}

/** @param {ESLint.Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const {parserServices} = sourceCode;
	const {program} = parserServices ?? {};

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const parsed = parseAssertionCall(node, imports);
		if (parsed?.method !== 'rejects' || !isAssertionCallWithSupportedContext(node, tracker)) {
			return;
		}

		const [firstArgument] = node.arguments;
		if (!firstArgument || firstArgument.type === 'SpreadElement') {
			return;
		}

		const callback = unwrapTypeScriptExpression(firstArgument);
		if (
			!isFunction(callback)
			|| !callback.async
			|| callback.generator
			|| (callback.type === 'ArrowFunctionExpression' && callback.typeParameters)
			|| callback.params.length > 0
		) {
			return;
		}

		const awaited = getAwaitedCallbackBody(callback);
		if (
			!awaited
			|| containsSuspensionPoint(awaited.awaitExpression.argument, sourceCode.visitorKeys)
			|| (
				!isKnownAsyncCall(awaited.awaitExpression.argument, sourceCode)
				&& (!program || !hasBuiltInPromiseType(awaited.awaitExpression.argument, parserServices, program))
			)
		) {
			return;
		}

		return {
			node: callback,
			messageId: MESSAGE_ID,
			suggest: [
				{
					messageId: MESSAGE_ID_SUGGESTION,
					/** @param {ESLint.Rule.RuleFixer} fixer */
					* fix(fixer, {abort}) {
						if (awaited.shouldAddReturn && isParenthesized(awaited.awaitExpression, context)) {
							return abort();
						}

						const asyncToken = sourceCode.getFirstToken(callback);
						const tokenAfterAsync = sourceCode.getTokenAfter(asyncToken);
						const asyncRange = [sourceCode.getRange(asyncToken)[0], sourceCode.getRange(tokenAfterAsync)[0]];
						if (hasCommentInRange(sourceCode, callback, asyncRange)) {
							return abort();
						}

						yield fixer.removeRange(asyncRange);

						const awaitToken = sourceCode.getFirstToken(awaited.awaitExpression);
						const tokenAfterAwait = sourceCode.getTokenAfter(awaitToken);
						const awaitRange = [sourceCode.getRange(awaitToken)[0], sourceCode.getRange(tokenAfterAwait)[0]];
						if (hasCommentInRange(sourceCode, callback, awaitRange)) {
							return abort();
						}

						if (awaited.shouldAddReturn) {
							yield fixer.replaceTextRange(awaitRange, 'return ');
						} else {
							yield fixer.removeRange(awaitRange);
						}
					},
				},
			],
		};
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {ESLint.Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow unneeded async callbacks passed to `assert.rejects()`.',
			recommended: false,
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import {
	isParenthesized,
	getParentheses,
	getParenthesizedRange,
	unwrapTypeScriptExpression,
} from './utils/index.js';

const MESSAGE_ID_PREFER_BLOCK = 'consistent-assert-throws-callback-style/prefer-block';
const MESSAGE_ID_PREFER_EXPRESSION = 'consistent-assert-throws-callback-style/prefer-expression';

const messages = {
	[MESSAGE_ID_PREFER_BLOCK]: 'Use a block body for the `assert.throws()` callback.',
	[MESSAGE_ID_PREFER_EXPRESSION]: 'Use an expression body for the `assert.throws()` callback.',
};

const expressionStatementUnsafeTypes = new Set([
	'AssignmentExpression',
	'ClassExpression',
	'FunctionExpression',
	'ObjectExpression',
]);

const arrowExpressionBodyUnsafeTypes = new Set([
	...expressionStatementUnsafeTypes,
	'SequenceExpression',
]);

function getLineIndentation(sourceCode, node) {
	return sourceCode.lines[sourceCode.getLoc(node).start.line - 1].match(/^\s*/)[0];
}

function getLeadingComments(sourceCode, node, context) {
	const [openingParenthesis] = getParentheses(node, context);
	const target = openingParenthesis ?? node;
	const previousToken = sourceCode.getTokenBefore(target);
	if (!previousToken) {
		return [];
	}

	const previousTokenEnd = sourceCode.getRange(previousToken)[1];
	return sourceCode.getCommentsBefore(target).filter(comment => sourceCode.getRange(comment)[0] > previousTokenEnd);
}

function hasTrailingComment(sourceCode, node, context) {
	const parentheses = getParentheses(node, context);
	const target = parentheses.at(-1) ?? node;
	const nextToken = sourceCode.getTokenAfter(target, {includeComments: true});
	return nextToken?.type === 'Block' || nextToken?.type === 'Line';
}

function getExpressionReplacement(node, context) {
	const {sourceCode} = context;
	const isBodyParenthesized = isParenthesized(node, context);
	const range = isBodyParenthesized ? getParenthesizedRange(node, context) : sourceCode.getRange(node);
	const [leadingComment] = getLeadingComments(sourceCode, node, context);
	const [start, end] = leadingComment ? [sourceCode.getRange(leadingComment)[0], range[1]] : range;
	const text = sourceCode.text.slice(start, end);
	const unwrappedNode = unwrapTypeScriptExpression(node);

	return {
		range: [start, end],
		text: !isBodyParenthesized && expressionStatementUnsafeTypes.has(unwrappedNode.type) ? `(${text})` : text,
	};
}

function hasLineCommentInRange(sourceCode, range) {
	return sourceCode.getAllComments().some(comment => comment.type === 'Line' && sourceCode.getRange(comment)[0] >= range[0] && sourceCode.getRange(comment)[1] <= range[1]);
}

function isBodyOnSameLine(callback, context) {
	return context.sourceCode.getLoc(callback.body).start.line === context.sourceCode.getLoc(callback).start.line;
}

function canFixExpressionCallback(callback, context) {
	const {sourceCode} = context;
	if (
		!isBodyOnSameLine(callback, context)
		|| callback.async
		|| callback.returnType
	) {
		return false;
	}

	const replacement = getExpressionReplacement(callback.body, context);
	return (
		!hasLineCommentInRange(sourceCode, sourceCode.getRange(replacement))
		&& !hasTrailingComment(sourceCode, callback.body, context)
	);
}

function getSingleExpressionStatement(callback) {
	if (callback.body.type !== 'BlockStatement' || callback.body.body.length !== 1) {
		return undefined;
	}

	const [statement] = callback.body.body;
	return statement.type === 'ExpressionStatement' ? statement : undefined;
}

function getExpressionBodyReplacement(statement, context) {
	const {sourceCode} = context;
	const {expression} = statement;
	const text = sourceCode.getText(expression);
	const unwrappedExpression = unwrapTypeScriptExpression(expression);

	return arrowExpressionBodyUnsafeTypes.has(unwrappedExpression.type) ? `(${text})` : text;
}

function canFixBlockCallback(callback, context) {
	const {sourceCode} = context;
	return (
		isBodyOnSameLine(callback, context)
		&& !callback.async
		&& !callback.returnType
		&& sourceCode.getCommentsInside(callback.body).length === 0
	);
}

function getContextAssertIdentifier(node) {
	const {callee} = node;
	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'MemberExpression'
		&& !callee.object.computed
		&& callee.object.object.type === 'Identifier'
		&& callee.object.property.type === 'Identifier'
		&& callee.object.property.name === 'assert'
	) {
		return callee.object.object;
	}

	return undefined;
}

function isCurrentTestContextIdentifier(identifier, tracker, sourceCode) {
	const callback = tracker.currentCallback();
	if (!callback || !tracker.isContextName(identifier.name)) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(identifier), identifier);
	return variable?.identifiers.some(identifier => callback.params.includes(identifier)) ?? false;
}

function isSupportedAssertionCall(node, context, tracker) {
	const {sourceCode} = context;
	const contextAssertIdentifier = getContextAssertIdentifier(node);
	return !contextAssertIdentifier || isCurrentTestContextIdentifier(contextAssertIdentifier, tracker, sourceCode);
}

function getBlockStyleProblem(callback, context) {
	if (callback.body.type === 'BlockStatement') {
		return undefined;
	}

	const {sourceCode} = context;
	const problem = {
		node: callback.body,
		messageId: MESSAGE_ID_PREFER_BLOCK,
	};

	if (canFixExpressionCallback(callback, context)) {
		problem.fix = fixer => {
			const indentation = getLineIndentation(sourceCode, callback);
			const replacement = getExpressionReplacement(callback.body, context);

			return fixer.replaceTextRange(
				sourceCode.getRange(replacement),
				`{\n${indentation}\t${replacement.text};\n${indentation}}`,
			);
		};
	}

	return problem;
}

function getExpressionStyleProblem(callback, context) {
	const statement = getSingleExpressionStatement(callback);
	if (!statement) {
		return undefined;
	}

	const problem = {
		node: callback.body,
		messageId: MESSAGE_ID_PREFER_EXPRESSION,
	};

	if (canFixBlockCallback(callback, context)) {
		problem.fix = fixer => fixer.replaceText(
			callback.body,
			getExpressionBodyReplacement(statement, context),
		);
	}

	return problem;
}

function getProblem(node, context, state) {
	const {imports, tracker, style} = state;
	const assertion = parseAssertionCall(node, imports);
	if (assertion?.method !== 'throws' || !isSupportedAssertionCall(node, context, tracker)) {
		return undefined;
	}

	const [firstArgument] = node.arguments;
	const callback = firstArgument && unwrapTypeScriptExpression(firstArgument);
	if (
		!callback
		|| callback.type !== 'ArrowFunctionExpression'
	) {
		return undefined;
	}

	return style === 'block' ? getBlockStyleProblem(callback, context) : getExpressionStyleProblem(callback, context);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);
	const {style} = context.options[0];
	const state = {imports, tracker, style};

	context.on('CallExpression', node => {
		const problem = getProblem(node, context, state);
		tracker.update(node);
		return problem;
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'layout',
		docs: {
			description: 'Enforce a consistent body style for `assert.throws()` arrow callbacks.',
			recommended: false,
		},
		fixable: 'code',
		schema: [
			{
				type: 'object',
				properties: {
					style: {
						enum: ['block', 'expression'],
						description: 'Whether `assert.throws()` arrow callbacks should use block bodies or expression bodies.',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{style: 'block'}],
		messages,
		languages: ['js/js'],
	},
};

export default config;

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

const MESSAGE_ID = 'prefer-assert-throws-block';

const messages = {
	[MESSAGE_ID]: 'Use a block body for the `assert.throws()` callback.',
};

const expressionStatementUnsafeTypes = new Set([
	'AssignmentExpression',
	'ClassExpression',
	'FunctionExpression',
	'ObjectExpression',
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

function canFixCallback(callback, context) {
	const {sourceCode} = context;
	const replacement = getExpressionReplacement(callback.body, context);

	return (
		!callback.async
		&& !callback.returnType
		&& !hasLineCommentInRange(sourceCode, sourceCode.getRange(replacement))
		&& !hasTrailingComment(sourceCode, callback.body, context)
	);
}

function getAssertImportIdentifier(node, imports) {
	const {callee} = node;
	if (
		callee.type === 'Identifier'
		&& (imports.assertNamed.has(callee.name) || imports.assertNamespace.has(callee.name))
	) {
		return callee;
	}

	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'Identifier'
		&& imports.assertNamespace.has(callee.object.name)
	) {
		return callee.object;
	}

	return undefined;
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

function isImportBinding(identifier, sourceCode) {
	const variable = findVariable(sourceCode.getScope(identifier), identifier);
	return variable?.defs.some(definition => definition.type === 'ImportBinding') ?? false;
}

function isCurrentTestContextIdentifier(identifier, tracker, sourceCode) {
	const callback = tracker.currentCallback();
	if (!callback || !tracker.isContextName(identifier.name)) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(identifier), identifier);
	return variable?.identifiers.some(identifier => callback.params.includes(identifier)) ?? false;
}

function isSupportedAssertionCall(node, imports, context, tracker) {
	const {sourceCode} = context;
	const assertImportIdentifier = getAssertImportIdentifier(node, imports);
	if (assertImportIdentifier) {
		return isImportBinding(assertImportIdentifier, sourceCode);
	}

	const contextAssertIdentifier = getContextAssertIdentifier(node);
	return contextAssertIdentifier ? isCurrentTestContextIdentifier(contextAssertIdentifier, tracker, sourceCode) : false;
}

function getProblem(node, context, imports, tracker) {
	const {sourceCode} = context;
	const assertion = parseAssertionCall(node, imports);
	if (assertion?.method !== 'throws' || !isSupportedAssertionCall(node, imports, context, tracker)) {
		return undefined;
	}

	const [firstArgument] = node.arguments;
	const callback = firstArgument && unwrapTypeScriptExpression(firstArgument);
	if (
		!callback
		|| callback.type !== 'ArrowFunctionExpression'
		|| callback.body.type === 'BlockStatement'
	) {
		return undefined;
	}

	const problem = {
		node: callback.body,
		messageId: MESSAGE_ID,
	};

	if (canFixCallback(callback, context)) {
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

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		const problem = getProblem(node, context, imports, tracker);
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
			description: 'Prefer block-bodied callbacks in `assert.throws()`.',
			recommended: false,
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

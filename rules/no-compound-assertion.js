import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-compound-assertion';

const messages = {
	[MESSAGE_ID]: 'Split this compound assertion into separate assertions so the failing operand is clear.',
};

function getConjunctionOperands(node) {
	const unwrappedNode = unwrapTypeScriptExpression(node);

	if (unwrappedNode.type !== 'LogicalExpression' || unwrappedNode.operator !== '&&') {
		return [node];
	}

	return [
		...getConjunctionOperands(unwrappedNode.left),
		...getConjunctionOperands(unwrappedNode.right),
	];
}

function getIndent(sourceCode, node) {
	const prefix = sourceCode.lines[sourceCode.getLoc(node).start.line - 1].slice(0, sourceCode.getLoc(node).start.column);
	return /^\s*$/.test(prefix) ? prefix : undefined;
}

function hasOnlyWhitespaceAfterStatement(sourceCode, node) {
	const location = sourceCode.getLoc(node);
	const suffix = sourceCode.lines[location.end.line - 1].slice(location.end.column);
	return /^\s*$/.test(suffix);
}

function getOperandText(sourceCode, operand) {
	const text = sourceCode.getText(operand);
	return operand.type === 'SequenceExpression' ? `(${text})` : text;
}

function buildFix({node, operands, sourceCode}) {
	return fixer => {
		if (
			node.arguments.length !== 1
			|| node.parent.type !== 'ExpressionStatement'
			|| !['Program', 'BlockStatement'].includes(node.parent.parent.type)
			|| sourceCode.getCommentsInside(node.parent).length > 0
			|| !hasOnlyWhitespaceAfterStatement(sourceCode, node.parent)
		) {
			return undefined;
		}

		const callee = sourceCode.getText(node.callee);
		const indent = getIndent(sourceCode, node.parent);
		if (indent === undefined) {
			return undefined;
		}

		const replacement = operands
			.map(operand => `${callee}(${getOperandText(sourceCode, operand)});`)
			.join(`\n${indent}`);

		return fixer.replaceText(node.parent, replacement);
	};
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const assertion = parseSupportedAssertionCall(node, imports, tracker);
		if (assertion?.method !== 'ok') {
			return;
		}

		const [firstArgument] = node.arguments;
		if (!firstArgument || firstArgument.type === 'SpreadElement') {
			return;
		}

		const argument = unwrapTypeScriptExpression(firstArgument);
		if (argument.type !== 'LogicalExpression' || argument.operator !== '&&') {
			return;
		}

		const operands = getConjunctionOperands(argument);

		return {
			node,
			messageId: MESSAGE_ID,
			fix: buildFix({node, operands, sourceCode}),
		};
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
			description: 'Disallow compound truthiness assertions.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

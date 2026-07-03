import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseAssertionCall,
	parseTestCall,
	getSubtestReceiver,
	createContextTracker,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-compound-assertion';

const messages = {
	[MESSAGE_ID]: 'Split this compound assertion into separate assertions so the failing operand is clear.',
};

const ASSERT_MODULES = new Set(['node:assert', 'node:assert/strict', 'assert', 'assert/strict']);
const TEST_MODULES = new Set(['node:test', 'test']);

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

function getContextAssertReceiver(node) {
	const {callee} = node;
	if (
		callee.type !== 'MemberExpression'
		|| callee.computed
		|| callee.object.type !== 'MemberExpression'
		|| callee.object.computed
		|| callee.object.object.type !== 'Identifier'
		|| callee.object.property.type !== 'Identifier'
		|| callee.object.property.name !== 'assert'
	) {
		return;
	}

	return callee.object.object;
}

function getAssertionRoot(node) {
	const {callee} = node;

	if (callee.type === 'Identifier') {
		return callee;
	}

	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'Identifier'
	) {
		return callee.object;
	}

	return getContextAssertReceiver(node);
}

function getCalleeRoot(node) {
	if (
		node.type !== 'Identifier'
		&& node.type !== 'MemberExpression'
	) {
		return undefined;
	}

	while (
		node.type === 'MemberExpression'
		&& !node.computed
	) {
		node = node.object;
	}

	return node.type === 'Identifier' ? node : undefined;
}

function isImportBinding(identifier, sourceCode, modules) {
	if (!identifier) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(identifier), identifier);
	return variable?.defs.some(definition =>
		definition.type === 'ImportBinding'
		&& modules.has(definition.parent.source.value)) ?? false;
}

function isImportedAssertBinding(identifier, sourceCode) {
	return isImportBinding(identifier, sourceCode, ASSERT_MODULES);
}

function isImportedTestBinding(identifier, sourceCode) {
	return isImportBinding(identifier, sourceCode, TEST_MODULES);
}

function isCurrentContextBinding(identifier, contextTracker, sourceCode) {
	const callback = contextTracker.currentCallback();
	if (!callback) {
		return false;
	}

	const parameter = callback.params[0];
	if (parameter?.type !== 'Identifier' || parameter.name !== identifier.name) {
		return false;
	}

	const [callbackStart, callbackEnd] = sourceCode.getRange(callback);
	const [identifierStart] = sourceCode.getRange(identifier);
	if (identifierStart < callbackStart || identifierStart >= callbackEnd) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(identifier), identifier);
	const contextVariable = sourceCode.getDeclaredVariables(callback).find(variable => variable.name === identifier.name);
	return variable === contextVariable;
}

function shouldTrackContextCall(node, imports, contextTracker, sourceCode) {
	const parsed = parseTestCall(node, imports);
	if (parsed && (parsed.kind === 'test' || parsed.kind === 'hook')) {
		const root = getCalleeRoot(node.callee);
		return root ? isImportedTestBinding(root, sourceCode) : false;
	}

	const receiver = getSubtestReceiver(node);
	return receiver ? isCurrentContextBinding(receiver, contextTracker, sourceCode) : false;
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

	const contextTracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		if (shouldTrackContextCall(node, imports, contextTracker, sourceCode)) {
			contextTracker.update(node);
		}

		const assertion = parseAssertionCall(node, imports);
		if (assertion?.method !== 'ok') {
			return;
		}

		const contextAssertReceiver = getContextAssertReceiver(node);
		if (contextAssertReceiver && !isCurrentContextBinding(contextAssertReceiver, contextTracker, sourceCode)) {
			return;
		}

		const assertionRoot = getAssertionRoot(node);
		if (!contextAssertReceiver && !isImportedAssertBinding(assertionRoot, sourceCode)) {
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
		contextTracker.leave(node);
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

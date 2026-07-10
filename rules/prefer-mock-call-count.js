import {resolveImports} from './utils/node-test.js';
import {isTypeScriptExpressionWrapper} from './utils/index.js';

const MESSAGE_ID = 'prefer-mock-call-count';

const messages = {
	[MESSAGE_ID]: 'Prefer `{{mock}}.callCount()` over `{{mock}}.calls.length`, which creates a copy of the call history.',
};

const isDirectWriteTarget = (node, parent) => (
	(parent.type === 'AssignmentExpression' && parent.left === node)
	|| (parent.type === 'UpdateExpression' && parent.argument === node)
	|| (parent.type === 'UnaryExpression' && parent.operator === 'delete' && parent.argument === node)
	|| ((parent.type === 'ForInStatement' || parent.type === 'ForOfStatement') && parent.left === node)
);

const getPatternParent = (node, parent) => {
	if (
		parent.type === 'ArrayPattern'
		|| (parent.type === 'AssignmentPattern' && parent.left === node)
		|| (parent.type === 'RestElement' && parent.argument === node)
		|| isTypeScriptExpressionWrapper(parent)
	) {
		return parent;
	}

	if (
		parent.type === 'Property'
		&& parent.value === node
		&& parent.parent.type === 'ObjectPattern'
	) {
		return parent.parent;
	}
};

const isWritableReference = initialNode => {
	let node = initialNode;

	while (true) {
		const {parent} = node;
		if (isDirectWriteTarget(node, parent)) {
			return true;
		}

		node = getPatternParent(node, parent);
		if (!node) {
			return false;
		}
	}
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {sourceCode} = context;

	context.on('MemberExpression', node => {
		if (
			node.computed
			|| node.optional
			|| node.property.type !== 'Identifier'
			|| node.property.name !== 'length'
			|| isWritableReference(node)
		) {
			return;
		}

		const calls = node.object;
		if (
			calls.type !== 'MemberExpression'
			|| calls.computed
			|| calls.optional
			|| calls.property.type !== 'Identifier'
			|| calls.property.name !== 'calls'
		) {
			return;
		}

		const mock = calls.object;
		if (
			mock.type !== 'MemberExpression'
			|| mock.computed
			|| mock.optional
			|| mock.property.type !== 'Identifier'
			|| mock.property.name !== 'mock'
		) {
			return;
		}

		const mockText = sourceCode.getText(mock);
		const replacement = `${mockText}.callCount()`;
		const isNewExpressionCallee = node.parent.type === 'NewExpression' && node.parent.callee === node;
		return {
			node,
			messageId: MESSAGE_ID,
			data: {mock: mockText},
			fix: sourceCode.getCommentsInside(node).length === 0
				? fixer => fixer.replaceText(node, isNewExpressionCallee ? `(${replacement})` : replacement)
				: undefined,
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer `mock.callCount()` over `mock.calls.length`.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

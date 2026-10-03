import {resolveImports} from './utils/node-test.js';
import {isExpressionWrapper, outermostExpressionWrapper} from './utils/index.js';
import {isMemberExpression} from './ast/index.js';

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
		|| parent.type === 'ObjectPattern'
		|| (parent.type === 'AssignmentPattern' && parent.left === node)
		|| (parent.type === 'RestElement' && parent.argument === node)
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

		if (
			isExpressionWrapper(parent)
			|| (parent.type === 'MemberExpression' && parent.object === node)
		) {
			node = parent;
			continue;
		}

		node = getPatternParent(node, parent);
		if (!node) {
			return false;
		}
	}
};

const isDirectlyCalledOrTagged = initialNode => {
	const node = outermostExpressionWrapper(initialNode);
	return (
		(node.parent.type === 'CallExpression' && node.parent.callee === node)
		|| (node.parent.type === 'TaggedTemplateExpression' && node.parent.tag === node)
	);
};

const isInNewExpressionCallee = node => {
	while (true) {
		node = outermostExpressionWrapper(node);
		const {parent} = node;
		if (parent.type === 'MemberExpression' && parent.object === node) {
			node = parent;
			continue;
		}

		return parent.type === 'NewExpression' && parent.callee === node;
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
			!isMemberExpression(node, {property: 'length', optional: false})
			|| isWritableReference(node)
			|| isDirectlyCalledOrTagged(node)
			|| isInNewExpressionCallee(node)
		) {
			return;
		}

		const calls = node.object;
		if (
			!isMemberExpression(calls, {property: 'calls', optional: false})
		) {
			return;
		}

		const mock = calls.object;
		if (
			!isMemberExpression(mock, {property: 'mock', optional: false})
		) {
			return;
		}

		const mockText = sourceCode.getText(mock);
		return {
			node,
			messageId: MESSAGE_ID,
			data: {mock: mockText},
			fix: sourceCode.getCommentsInside(node).length === 0
				? fixer => fixer.replaceText(node, `${mockText}.callCount()`)
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

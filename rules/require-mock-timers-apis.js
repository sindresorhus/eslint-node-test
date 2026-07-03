import {findVariable} from '@eslint-community/eslint-utils';
import {
	findOptionsProperty,
	getSubtestReceiver,
	getTestCallback,
	parseTestCall,
	resolveImports,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'require-mock-timers-apis';

const messages = {
	[MESSAGE_ID]: '`mock.timers.enable()` should explicitly specify the `apis` option to avoid unexpectedly mocking `Date`.',
};

function isImportedReference(node, sourceCode) {
	const variable = findVariable(sourceCode.getScope(node), node);
	return variable?.defs.some(({type}) => type === 'ImportBinding') ?? false;
}

function getCalleeRoot(node) {
	let current = node;

	while (current.type === 'MemberExpression') {
		current = current.object;
	}

	return current.type === 'Identifier' ? current : undefined;
}

function isMissingApisOption(callExpression) {
	const firstArgument = unwrapTypeScriptExpression(callExpression.arguments[0]);
	if (!firstArgument) {
		return true;
	}

	if (firstArgument.type === 'Identifier' && firstArgument.name === 'undefined') {
		return true;
	}

	if (firstArgument.type !== 'ObjectExpression') {
		return false;
	}

	return !findOptionsProperty(firstArgument, 'apis');
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const contextVariables = [];
	const pushedCalls = new Set();

	const isImportedTestCall = node => {
		const root = getCalleeRoot(node.callee);
		return root !== undefined
			&& isImportedReference(root, sourceCode)
			&& parseTestCall(node, imports)?.kind === 'test';
	};

	const isSubtestCall = node => {
		const receiver = getSubtestReceiver(node);
		if (!receiver) {
			return false;
		}

		const variable = findVariable(sourceCode.getScope(receiver), receiver);
		return variable !== undefined && contextVariables.includes(variable);
	};

	const updateContext = node => {
		if (!isImportedTestCall(node) && !isSubtestCall(node)) {
			return;
		}

		const callback = getTestCallback(node);
		if (!callback) {
			return;
		}

		const parameter = callback.params[0];
		const variable = parameter?.type === 'Identifier'
			? findVariable(sourceCode.getScope(parameter), parameter)
			: undefined;

		contextVariables.push(variable);
		pushedCalls.add(node);
	};

	const leaveContext = node => {
		if (!pushedCalls.has(node)) {
			return;
		}

		pushedCalls.delete(node);
		contextVariables.pop();
	};

	const isGlobalMock = node =>
		(
			node.type === 'Identifier'
			&& imports.mockLocals.has(node.name)
			&& isImportedReference(node, sourceCode)
		)
		|| (
			node.type === 'MemberExpression'
			&& !node.computed
			&& node.property.type === 'Identifier'
			&& node.property.name === 'mock'
			&& node.object.type === 'Identifier'
			&& node.object.name === imports.namespace
			&& isImportedReference(node.object, sourceCode)
		);

	const isCurrentContextReference = node => {
		const variable = contextVariables.at(-1);
		return variable !== undefined && findVariable(sourceCode.getScope(node), node) === variable;
	};

	const isContextMock = node =>
		node.type === 'MemberExpression'
		&& !node.computed
		&& node.property.type === 'Identifier'
		&& node.property.name === 'mock'
		&& node.object.type === 'Identifier'
		&& isCurrentContextReference(node.object);

	const isMockTimers = node =>
		node.type === 'MemberExpression'
		&& !node.computed
		&& node.property.type === 'Identifier'
		&& node.property.name === 'timers'
		&& (isGlobalMock(node.object) || isContextMock(node.object));

	context.on('CallExpression', node => {
		updateContext(node);
	});

	context.onExit('CallExpression', node => {
		leaveContext(node);
	});

	context.on('CallExpression', node => {
		const {callee} = node;
		if (
			callee.type === 'MemberExpression'
			&& !callee.computed
			&& callee.property.type === 'Identifier'
			&& callee.property.name === 'enable'
			&& isMockTimers(callee.object)
			&& isMissingApisOption(node)
		) {
			return {
				node,
				messageId: MESSAGE_ID,
			};
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Require an explicit `apis` option when enabling `mock.timers`.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

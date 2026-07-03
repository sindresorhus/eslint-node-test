import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getSubtestReceiver,
	HOOK_FUNCTIONS,
	isGlobalMock,
	MODIFIERS,
} from './utils/node-test.js';
import {getEnclosingFunction} from './utils/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'require-mock-timers-advance';
const messages = {
	[MESSAGE_ID]: '`mock.timers.enable()` must be followed by `tick()` or `runAll()` so mocked timer callbacks can run.',
};

const ADVANCE_METHODS = new Set(['tick', 'runAll']);

function getStaticPropertyName(node) {
	if (node.type === 'Identifier') {
		return node.name;
	}

	if (node.type === 'Literal' && typeof node.value === 'string') {
		return node.value;
	}
}

function getPropertyName(property) {
	if (property.type !== 'Property') {
		return;
	}

	if (!property.computed) {
		return getStaticPropertyName(property.key);
	}

	if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
		return property.key.value;
	}
}

function enablesTimerApis(callExpression) {
	const argument = unwrapTypeScriptExpression(callExpression.arguments[0]);
	if (argument?.type !== 'ObjectExpression') {
		return true;
	}

	let apisValue;
	for (const property of argument.properties) {
		if (property.type === 'SpreadElement') {
			if (apisValue) {
				return true;
			}

			continue;
		}

		if (getPropertyName(property) === 'apis') {
			apisValue = property.value;
		}
	}

	if (!apisValue) {
		return true;
	}

	const unwrappedApisValue = unwrapTypeScriptExpression(apisValue);
	if (unwrappedApisValue.type !== 'ArrayExpression') {
		return true;
	}

	for (const rawElement of unwrappedApisValue.elements) {
		const element = rawElement && unwrapTypeScriptExpression(rawElement);
		if (!element) {
			continue;
		}

		if (element.type !== 'Literal' || typeof element.value !== 'string') {
			return true;
		}

		if (element.value === 'Date') {
			continue;
		}

		return true;
	}

	return false;
}

function isImportedIdentifier(node, sourceCode) {
	const variable = findVariable(sourceCode.getScope(node), node);
	return variable?.defs.some(({type}) => type === 'ImportBinding') ?? false;
}

function getMockTimersReceiverKey(node, imports, sourceCode, contextVariables) {
	if (
		node.type !== 'MemberExpression'
		|| node.computed
		|| node.optional
		|| getStaticPropertyName(node.property) !== 'timers'
	) {
		return;
	}

	if (isGlobalMock(node.object, imports)) {
		return 'global';
	}

	if (
		node.object.type === 'MemberExpression'
		&& !node.object.computed
		&& !node.object.optional
		&& getStaticPropertyName(node.object.property) === 'mock'
		&& node.object.object.type === 'Identifier'
	) {
		const variable = findVariable(sourceCode.getScope(node.object.object), node.object.object);
		if (!variable || !contextVariables.includes(variable)) {
			return;
		}

		return `context:${node.object.object.name}`;
	}
}

function getMockTimersCall(callExpression, imports, sourceCode, contextVariables) {
	const {callee} = callExpression;
	if (
		callee.type !== 'MemberExpression'
		|| callee.computed
		|| callee.optional
	) {
		return;
	}

	const method = getStaticPropertyName(callee.property);
	const receiverKey = getMockTimersReceiverKey(callee.object, imports, sourceCode, contextVariables);
	if (!method || !receiverKey) {
		return;
	}

	return {method, receiverKey};
}

function satisfyPending(scope, predicate) {
	for (const pending of scope.pending) {
		if (!pending.satisfied && predicate(pending)) {
			pending.satisfied = true;
		}
	}
}

function getContextVariable(callback, sourceCode) {
	const [parameter] = callback.params;
	if (parameter?.type !== 'Identifier') {
		return;
	}

	return findVariable(sourceCode.getScope(parameter), parameter);
}

function getCalleeRootIdentifier(node) {
	while (
		node.type === 'MemberExpression'
		&& !node.computed
		&& !node.optional
	) {
		node = node.object;
	}

	return node.type === 'Identifier' ? node : undefined;
}

function getContextVariables(scopeStack) {
	return scopeStack
		.map(scope => scope.contextVariable)
		.filter(Boolean);
}

function getContextCallKind(node, sourceCode, contextVariables) {
	const receiver = getSubtestReceiver(node);
	if (receiver) {
		const receiverVariable = findVariable(sourceCode.getScope(receiver), receiver);
		return receiverVariable && contextVariables.includes(receiverVariable) ? 'test' : undefined;
	}

	const {callee} = node;
	if (
		callee.type !== 'MemberExpression'
		|| callee.computed
		|| callee.optional
		|| callee.object.type !== 'Identifier'
		|| !HOOK_FUNCTIONS.has(getStaticPropertyName(callee.property))
	) {
		return;
	}

	const receiverVariable = findVariable(sourceCode.getScope(callee.object), callee.object);
	return receiverVariable && contextVariables.includes(receiverVariable) ? 'hook' : undefined;
}

function getScopeCallback(node, imports, sourceCode, contextVariables) {
	const parsed = parseTestCall(node, imports);
	const root = getCalleeRootIdentifier(node.callee);
	if (
		(parsed?.kind === 'test' || parsed?.kind === 'hook')
		&& parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name))
		&& root
		&& isImportedIdentifier(root, sourceCode)
	) {
		return getTestCallback(node);
	}

	const contextCallKind = getContextCallKind(node, sourceCode, contextVariables);
	return contextCallKind === 'test' || contextCallKind === 'hook' ? getTestCallback(node) : undefined;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const scopeStack = [];

	context.on('CallExpression', node => {
		const callback = getScopeCallback(node, imports, sourceCode, getContextVariables(scopeStack));
		if (callback) {
			const contextVariable = getContextVariable(callback, sourceCode);
			scopeStack.push({
				callNode: node,
				callback,
				contextVariable,
				pending: [],
			});
		}

		if (scopeStack.length === 0) {
			return;
		}

		const currentScope = scopeStack.at(-1);
		if (getEnclosingFunction(node) !== currentScope.callback) {
			return;
		}

		const timersCall = getMockTimersCall(node, imports, sourceCode, getContextVariables(scopeStack));
		if (timersCall && ADVANCE_METHODS.has(timersCall.method)) {
			satisfyPending(currentScope, pending => pending.receiverKey === timersCall.receiverKey);
		}
	});

	context.onExit('CallExpression', node => {
		let problems;
		const currentScope = scopeStack.at(-1);
		if (currentScope?.callNode === node) {
			scopeStack.pop();
			problems = currentScope.pending
				.filter(pending => !pending.satisfied)
				.map(pending => ({
					node: pending.node,
					messageId: pending.messageId,
				}));
		}

		const newCurrentScope = scopeStack.at(-1);
		if (
			newCurrentScope
			&& getEnclosingFunction(node) === newCurrentScope.callback
		) {
			const timersCall = getMockTimersCall(node, imports, sourceCode, getContextVariables(scopeStack));
			if (timersCall?.method === 'enable' && enablesTimerApis(node)) {
				newCurrentScope.pending.push({
					node,
					messageId: MESSAGE_ID,
					receiverKey: timersCall.receiverKey,
					satisfied: false,
				});
			}
		}

		return problems;
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Require mock timers to be advanced after enabling timer APIs.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

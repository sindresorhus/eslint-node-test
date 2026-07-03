import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getSubtestReceiver,
	HOOK_FUNCTIONS,
} from './utils/node-test.js';
import {getEnclosingFunction} from './utils/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID_TIMERS = 'require-mock-timers-advance/timers';
const MESSAGE_ID_DATE = 'require-mock-timers-advance/date';
const messages = {
	[MESSAGE_ID_TIMERS]: '`mock.timers.enable()` must be followed by `tick()` or `runAll()` so mocked timer callbacks can run.',
	[MESSAGE_ID_DATE]: '`mock.timers.enable()` with only `Date` must be followed by a `Date` read, `tick()`, or `runAll()` so the mocked clock is used.',
};

const TIMER_APIS = new Set(['setTimeout', 'setInterval', 'setImmediate']);
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

function getEnabledApiKind(callExpression) {
	const argument = unwrapTypeScriptExpression(callExpression.arguments[0]);
	if (argument?.type !== 'ObjectExpression') {
		return 'timers';
	}

	let apisValue;
	for (const property of argument.properties) {
		if (property.type === 'SpreadElement') {
			if (apisValue) {
				return 'timers';
			}

			continue;
		}

		if (getPropertyName(property) === 'apis') {
			apisValue = property.value;
		}
	}

	if (!apisValue) {
		return 'timers';
	}

	const unwrappedApisValue = unwrapTypeScriptExpression(apisValue);
	if (unwrappedApisValue.type !== 'ArrayExpression') {
		return 'timers';
	}

	let hasDateApi = false;
	let hasApi = false;

	for (const rawElement of unwrappedApisValue.elements) {
		const element = rawElement && unwrapTypeScriptExpression(rawElement);
		if (!element) {
			continue;
		}

		if (element.type !== 'Literal' || typeof element.value !== 'string') {
			return 'timers';
		}

		hasApi = true;

		if (TIMER_APIS.has(element.value)) {
			return 'timers';
		}

		if (element.value === 'Date') {
			hasDateApi = true;
			continue;
		}

		return 'timers';
	}

	if (!hasApi) {
		return 'none';
	}

	return hasDateApi ? 'date' : 'none';
}

function isImportedIdentifier(node, sourceCode) {
	const variable = findVariable(sourceCode.getScope(node), node);
	return variable?.defs.some(({type}) => type === 'ImportBinding') ?? false;
}

function isGlobalMockReference(node, imports, sourceCode) {
	return (
		(
			node.type === 'Identifier'
			&& imports.mockLocals.has(node.name)
			&& isImportedIdentifier(node, sourceCode)
		)
		|| (
			node.type === 'MemberExpression'
			&& !node.computed
			&& !node.optional
			&& getStaticPropertyName(node.property) === 'mock'
			&& node.object.type === 'Identifier'
			&& node.object.name === imports.namespace
			&& isImportedIdentifier(node.object, sourceCode)
		)
	);
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

	if (isGlobalMockReference(node.object, imports, sourceCode)) {
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

function isUnshadowedGlobalIdentifier(node, sourceCode) {
	const variable = findVariable(sourceCode.getScope(node), node);
	return !variable || variable.defs.length === 0;
}

function isDateReadCall(node, sourceCode) {
	const {callee} = node;
	if (
		callee.type === 'Identifier'
		&& callee.name === 'Date'
		&& node.arguments.length === 0
	) {
		return isUnshadowedGlobalIdentifier(callee, sourceCode);
	}

	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& getStaticPropertyName(callee.property) === 'now'
		&& callee.object.type === 'Identifier'
		&& callee.object.name === 'Date'
	) {
		return isUnshadowedGlobalIdentifier(callee.object, sourceCode);
	}

	return false;
}

function isDateReadNewExpression(node, sourceCode) {
	return node.callee.type === 'Identifier'
		&& node.callee.name === 'Date'
		&& node.arguments.length === 0
		&& isUnshadowedGlobalIdentifier(node.callee, sourceCode);
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
			return;
		}

		if (isDateReadCall(node, sourceCode)) {
			satisfyPending(currentScope, pending => pending.apiKind === 'date');
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
			if (timersCall?.method === 'enable') {
				const apiKind = getEnabledApiKind(node);
				if (apiKind !== 'none') {
					newCurrentScope.pending.push({
						node,
						apiKind,
						messageId: apiKind === 'date' ? MESSAGE_ID_DATE : MESSAGE_ID_TIMERS,
						receiverKey: timersCall.receiverKey,
						satisfied: false,
					});
				}
			}
		}

		return problems;
	});

	context.on('NewExpression', node => {
		const currentScope = scopeStack.at(-1);
		if (
			!currentScope
			|| getEnclosingFunction(node) !== currentScope.callback
			|| !isDateReadNewExpression(node, sourceCode)
		) {
			return;
		}

		satisfyPending(currentScope, pending => pending.apiKind === 'date');
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

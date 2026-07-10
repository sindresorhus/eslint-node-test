import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getCalleeChain,
	getHookCallback,
	getTestCallback,
	getTestOptions,
	findEnabledOptionsProperty,
	isHookMemberTestCall,
	MODIFIERS,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {getEnclosingFunction} from './utils/index.js';
import {isFunction} from './ast/index.js';

const MESSAGE_ID = 'no-sleep-in-test';

const messages = {
	[MESSAGE_ID]: 'Do not sleep in tests with `setTimeout`. Await the real signal or use mock timers instead.',
};

const CALLBACK_TIMER_MODULES = new Set(['node:timers', 'timers']);
const PROMISE_TIMER_MODULES = new Set(['node:timers/promises', 'timers/promises']);
const ACTIVE_TEST_MODIFIERS = new Set(['only', 'todo']);
const CONTEXT_HOOKS = new Set(['before', 'beforeEach', 'after', 'afterEach']);

const unwrapExpression = node => {
	let unwrapped = node && unwrapTypeScriptExpression(node);
	while (unwrapped?.type === 'ChainExpression') {
		unwrapped = unwrapTypeScriptExpression(unwrapped.expression);
	}

	return unwrapped;
};

function isIdentifierReference(node, name) {
	return node?.type === 'Identifier' && node.name === name;
}

function isGlobalReference(sourceCode, node, name) {
	node = unwrapExpression(node);
	if (!isIdentifierReference(node, name)) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(node), node);
	return !variable || variable.defs.length === 0;
}

function isSameReference(sourceCode, node, variable) {
	node = unwrapExpression(node);
	return node?.type === 'Identifier'
		&& findVariable(sourceCode.getScope(node), node) === variable;
}

function isGlobalObjectSetTimeout(sourceCode, node) {
	node = unwrapExpression(node);
	return node?.type === 'MemberExpression'
		&& !node.computed
		&& (
			isGlobalReference(sourceCode, node.object, 'globalThis')
			|| isGlobalReference(sourceCode, node.object, 'global')
		)
		&& isIdentifierReference(node.property, 'setTimeout');
}

function areActiveModifiers(modifiers) {
	return modifiers.every(modifier => ACTIVE_TEST_MODIFIERS.has(modifier.name));
}

function hasInactiveTestOptions(node) {
	const options = getTestOptions(node);
	return Boolean(findEnabledOptionsProperty(options, 'skip'));
}

function getSubtestModifiers(node) {
	const {members = []} = getCalleeChain(node.callee) ?? {};
	return members?.[0]?.name === 'test' ? members.slice(1) : [];
}

function getSupportedSubtestReceiver(node) {
	const chain = getCalleeChain(node.callee);
	if (
		chain
		&& chain.members[0]?.name === 'test'
		&& chain.members.slice(1).every(member => MODIFIERS.has(member.name))
	) {
		return chain.root;
	}
}

function getContextHookReceiver(node) {
	const callee = unwrapExpression(node.callee);
	if (
		callee?.type !== 'MemberExpression'
		|| callee.computed
		|| callee.property.type !== 'Identifier'
		|| !CONTEXT_HOOKS.has(callee.property.name)
	) {
		return;
	}

	const receiver = unwrapExpression(callee.object);
	return receiver.type === 'Identifier' ? receiver : undefined;
}

function getParsedCallback(node, parsed) {
	if (getParsedKind(parsed) === 'hook') {
		return getHookCallback(node);
	}

	return getTestCallback(node);
}

function getParsedKind(parsed) {
	return isHookMemberTestCall(parsed) ? 'hook' : parsed.kind;
}

function getParsedModifiers(parsed) {
	return isHookMemberTestCall(parsed) ? [] : parsed.modifiers;
}

function hasInactiveParsedOptions(node, parsed) {
	return getParsedKind(parsed) !== 'hook' && hasInactiveTestOptions(node);
}

function getTimerImportBindings(sourceCode) {
	const named = new Set();
	const namespace = new Set();
	const promiseNamed = new Set();
	const promiseNamespace = new Set();

	for (const node of sourceCode.ast.body) {
		if (node.type !== 'ImportDeclaration') {
			continue;
		}

		const isCallbackTimerModule = CALLBACK_TIMER_MODULES.has(node.source.value);
		const isPromiseTimerModule = PROMISE_TIMER_MODULES.has(node.source.value);
		if (!isCallbackTimerModule && !isPromiseTimerModule) {
			continue;
		}

		for (const specifier of node.specifiers) {
			if (
				specifier.type === 'ImportSpecifier'
				&& specifier.imported.type === 'Identifier'
				&& specifier.imported.name === 'setTimeout'
			) {
				const variable = findVariable(sourceCode.getScope(specifier.local), specifier.local);
				if (variable) {
					(isPromiseTimerModule ? promiseNamed : named).add(variable);
				}
			}

			if (specifier.type === 'ImportNamespaceSpecifier' || specifier.type === 'ImportDefaultSpecifier') {
				const variable = findVariable(sourceCode.getScope(specifier.local), specifier.local);
				if (variable) {
					(isPromiseTimerModule ? promiseNamespace : namespace).add(variable);
				}
			}
		}
	}

	return {
		named, namespace, promiseNamed, promiseNamespace, sourceCode,
	};
}

function isImportedSetTimeout(node, sourceCode, named, namespace) {
	node = unwrapExpression(node);

	if (node?.type === 'Identifier') {
		return named.has(findVariable(sourceCode.getScope(node), node));
	}

	return node?.type === 'MemberExpression'
		&& !node.computed
		&& node.object.type === 'Identifier'
		&& namespace.has(findVariable(sourceCode.getScope(node.object), node.object))
		&& isIdentifierReference(node.property, 'setTimeout');
}

function isImportedTimerSetTimeout(node, timerImports) {
	return isImportedSetTimeout(node, timerImports.sourceCode, timerImports.named, timerImports.namespace);
}

function isImportedPromiseTimerSetTimeout(node, timerImports) {
	return isImportedSetTimeout(node, timerImports.sourceCode, timerImports.promiseNamed, timerImports.promiseNamespace);
}

function isSetTimeoutCallee(node, timerImports) {
	node = unwrapExpression(node);
	return isGlobalReference(timerImports.sourceCode, node, 'setTimeout')
		|| isGlobalObjectSetTimeout(timerImports.sourceCode, node)
		|| isImportedTimerSetTimeout(node, timerImports);
}

function containsExpression(node, predicate, visitorKeys) {
	const stack = [node];

	while (stack.length > 0) {
		const current = unwrapExpression(stack.pop());
		if (!current?.type) {
			continue;
		}

		if (predicate(current)) {
			return true;
		}

		if (isFunction(current)) {
			continue;
		}

		for (const key of visitorKeys[current.type] ?? []) {
			const child = current[key];
			for (const childNode of Array.isArray(child) ? child : [child]) {
				if (childNode?.type) {
					stack.push(childNode);
				}
			}
		}
	}

	return false;
}

function expressionCallsResolver(node, resolverVariable, sourceCode) {
	node = unwrapExpression(node);
	return node?.type === 'CallExpression'
		&& isSameReference(sourceCode, node.callee, resolverVariable);
}

function functionCallsResolver(node, resolverVariable, sourceCode) {
	node = unwrapExpression(node);
	if (!isFunction(node)) {
		return false;
	}

	return containsExpression(node.body, expression => expressionCallsResolver(expression, resolverVariable, sourceCode), sourceCode.visitorKeys);
}

function isResolverArgument(node, resolverVariable, sourceCode) {
	node = unwrapExpression(node);
	return isSameReference(sourceCode, node, resolverVariable) || functionCallsResolver(node, resolverVariable, sourceCode);
}

function isSleepSetTimeoutCall(node, resolverVariable, timerImports) {
	node = unwrapExpression(node);
	return node?.type === 'CallExpression'
		&& isSetTimeoutCallee(node.callee, timerImports)
		&& isResolverArgument(node.arguments[0], resolverVariable, timerImports.sourceCode);
}

function isSleepPromise(node, timerImports) {
	node = unwrapExpression(node);
	if (
		node?.type !== 'NewExpression'
		|| !isGlobalReference(timerImports.sourceCode, node.callee, 'Promise')
	) {
		return false;
	}

	const [executor] = node.arguments;
	const executorFunction = unwrapExpression(executor);
	const resolveOrRejectVariables = isFunction(executorFunction)
		? executorFunction.params.slice(0, 2)
			.filter(parameter => parameter.type === 'Identifier')
			.map(parameter => findVariable(timerImports.sourceCode.getScope(parameter), parameter))
			.filter(Boolean)
		: [];
	if (resolveOrRejectVariables.length === 0) {
		return false;
	}

	const isSleepCall = expression => resolveOrRejectVariables.some(resolveOrRejectVariable =>
		isSleepSetTimeoutCall(expression, resolveOrRejectVariable, timerImports));
	return containsExpression(executorFunction.body, isSleepCall, timerImports.sourceCode.visitorKeys);
}

function isPromiseTimerSleep(node, timerImports) {
	node = unwrapExpression(node);
	return node?.type === 'CallExpression'
		&& isImportedPromiseTimerSetTimeout(node.callee, timerImports);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const timerImports = getTimerImportBindings(context.sourceCode);
	const testStack = [];
	const inactiveCallbackStack = [];
	const trackedCalls = new Set();
	const {sourceCode} = context;

	const getContextVariable = callback => {
		const [parameter] = callback.params;
		if (parameter?.type !== 'Identifier') {
			return;
		}

		return findVariable(sourceCode.getScope(parameter), parameter);
	};

	const hasInactiveCallbackAncestor = node => {
		for (const {callback} of inactiveCallbackStack) {
			let current = node;
			while (current) {
				if (current === callback) {
					return true;
				}

				current = current.parent;
			}
		}

		return false;
	};

	const isCurrentTestContextReceiver = (node, receiver) => {
		const currentTest = testStack.at(-1);
		if (!currentTest?.contextVariable) {
			return false;
		}

		const receiverVariable = findVariable(sourceCode.getScope(receiver), receiver);
		return getEnclosingFunction(node) === currentTest.callback
			&& currentTest.contextVariable === receiverVariable;
	};

	const isCurrentTestContextSubtestCall = node => {
		const receiver = getSupportedSubtestReceiver(node);
		if (receiver?.type !== 'Identifier') {
			return false;
		}

		return isCurrentTestContextReceiver(node, receiver);
	};

	const isCurrentTestContextHookCall = node => {
		const receiver = getContextHookReceiver(node);
		if (!receiver) {
			return false;
		}

		return isCurrentTestContextReceiver(node, receiver);
	};

	const isActiveSubtestCall = node => isCurrentTestContextSubtestCall(node)
		&& areActiveModifiers(getSubtestModifiers(node))
		&& !hasInactiveTestOptions(node);

	const isInactiveSubtestCall = node => isCurrentTestContextSubtestCall(node)
		&& (
			!areActiveModifiers(getSubtestModifiers(node))
			|| hasInactiveTestOptions(node)
		);

	const getScopeBoundaryCallback = node => {
		if (hasInactiveCallbackAncestor(node)) {
			return;
		}

		const parsed = parseTestCall(node, imports);
		if (parsed) {
			const kind = getParsedKind(parsed);

			return (
				(kind === 'test' || kind === 'hook')
				&& areActiveModifiers(getParsedModifiers(parsed))
				&& !hasInactiveParsedOptions(node, parsed)
			)
				? getParsedCallback(node, parsed)
				: undefined;
		}

		if (isCurrentTestContextHookCall(node)) {
			return getHookCallback(node);
		}

		return isActiveSubtestCall(node) ? getTestCallback(node) : undefined;
	};

	const getInactiveScopeCallback = node => {
		const parsed = parseTestCall(node, imports);
		if (parsed) {
			return (
				!areActiveModifiers(getParsedModifiers(parsed))
				|| hasInactiveParsedOptions(node, parsed)
			)
				? getParsedCallback(node, parsed)
				: undefined;
		}

		if (!isInactiveSubtestCall(node)) {
			return;
		}

		return getTestCallback(node);
	};

	const isInsideTestCallback = node => {
		const testCallback = testStack.at(-1)?.callback;
		return testCallback ? getEnclosingFunction(node) === testCallback : false;
	};

	context.on('CallExpression', node => {
		const inactiveScopeCallback = getInactiveScopeCallback(node);
		if (inactiveScopeCallback) {
			inactiveCallbackStack.push({node, callback: inactiveScopeCallback});
			trackedCalls.add(node);
			return;
		}

		const boundaryCallback = getScopeBoundaryCallback(node);
		if (boundaryCallback) {
			testStack.push({
				callback: boundaryCallback,
				contextVariable: getContextVariable(boundaryCallback),
			});
			trackedCalls.add(node);
		}
	});

	context.onExit('CallExpression', node => {
		if (!trackedCalls.has(node)) {
			return;
		}

		trackedCalls.delete(node);
		if (inactiveCallbackStack.at(-1)?.node === node) {
			inactiveCallbackStack.pop();
		} else {
			testStack.pop();
		}
	});

	context.on('NewExpression', node => {
		if (!isInsideTestCallback(node) || !isSleepPromise(node, timerImports)) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
		};
	});

	context.on('CallExpression', node => {
		if (!isInsideTestCallback(node) || !isPromiseTimerSleep(node, timerImports)) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow sleeping in tests with `setTimeout`.',
			recommended: false,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

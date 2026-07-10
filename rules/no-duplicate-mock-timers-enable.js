import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import {
	createContextTracker,
	findOptionsProperty,
	getHookCallback,
	getTestCallback,
	getTestOptions,
	isGlobalMock,
	resolveImports,
} from './utils/node-test.js';
import {getEnclosingFunction} from './utils/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-duplicate-mock-timers-enable';
const messages = {
	[MESSAGE_ID]: '`mock.timers.enable()` is already active on this mock tracker. Call `reset()` before enabling mock timers again.',
};

const GLOBAL_RECEIVER = Symbol('global receiver');
const CONTEXT_HOOKS = new Set(['before', 'after', 'beforeEach', 'afterEach']);

function getStaticPropertyName(node) {
	if (node.type === 'Identifier') {
		return node.name;
	}

	if (node.type === 'Literal' && typeof node.value === 'string') {
		return node.value;
	}
}

function getContextMockReceiver(node, contextTracker, contextHookVariables, imports) {
	const expression = unwrapTypeScriptExpression(node);
	if (
		expression.type !== 'MemberExpression'
		|| expression.computed
		|| expression.optional
		|| getStaticPropertyName(expression.property) !== 'mock'
	) {
		return undefined;
	}

	const context = unwrapTypeScriptExpression(expression.object);
	if (context.type !== 'Identifier') {
		return undefined;
	}

	const variable = findVariable(imports.sourceCode.getScope(context), context);
	if (!variable || (!contextTracker.isContextIdentifier(context) && !contextHookVariables.has(variable))) {
		return undefined;
	}

	return variable;
}

function getMockReceiver(node, contextTracker, contextHookVariables, imports) {
	const expression = unwrapTypeScriptExpression(node);
	if (isGlobalMock(expression, imports)) {
		return GLOBAL_RECEIVER;
	}

	return getContextMockReceiver(expression, contextTracker, contextHookVariables, imports);
}

function getMockTimersReceiver(node, contextTracker, contextHookVariables, imports) {
	const expression = unwrapTypeScriptExpression(node);
	if (
		expression.type !== 'MemberExpression'
		|| expression.computed
		|| expression.optional
		|| getStaticPropertyName(expression.property) !== 'timers'
	) {
		return undefined;
	}

	return getMockReceiver(expression.object, contextTracker, contextHookVariables, imports);
}

function getMockAction(callExpression, contextTracker, contextHookVariables, imports) {
	if (callExpression.optional) {
		return undefined;
	}

	const callee = unwrapTypeScriptExpression(callExpression.callee);
	if (
		callee.type !== 'MemberExpression'
		|| callee.computed
		|| callee.optional
	) {
		return undefined;
	}

	const method = getStaticPropertyName(callee.property);
	if (method === 'enable' || method === 'reset') {
		const receiver = getMockTimersReceiver(callee.object, contextTracker, contextHookVariables, imports);
		if (receiver) {
			return {receiver, method};
		}
	}

	if (method === 'reset') {
		const receiver = getMockReceiver(callee.object, contextTracker, contextHookVariables, imports);
		if (receiver) {
			return {receiver, method};
		}
	}
}

function getContextHookCallback(callExpression, contextTracker) {
	const callee = unwrapTypeScriptExpression(callExpression.callee);
	if (
		callee.type !== 'MemberExpression'
		|| callee.computed
		|| callee.optional
		|| getStaticPropertyName(callee.property) === undefined
		|| !CONTEXT_HOOKS.has(getStaticPropertyName(callee.property))
	) {
		return undefined;
	}

	const receiver = unwrapTypeScriptExpression(callee.object);
	return receiver.type === 'Identifier' && contextTracker.isContextIdentifier(receiver)
		? getHookCallback(callExpression)
		: undefined;
}

function hasSkipModifier(node) {
	node = unwrapTypeScriptExpression(node);
	while (node.type === 'MemberExpression') {
		if (!node.computed && getStaticPropertyName(node.property) === 'skip') {
			return true;
		}

		node = unwrapTypeScriptExpression(node.object);
	}

	return false;
}

function isSkippedTestCall(node, sourceCode) {
	if (hasSkipModifier(node.callee)) {
		return true;
	}

	const skipOption = findOptionsProperty(getTestOptions(node), 'skip');
	const staticValue = skipOption && getStaticValue(skipOption.value, sourceCode.getScope(skipOption.value));
	return staticValue !== null && Boolean(staticValue?.value);
}

function isInsideSkippedCallback(node, skippedCallbacks) {
	for (let current = node.parent; current; current = current.parent) {
		if (skippedCallbacks.has(current)) {
			return true;
		}
	}

	return false;
}

function getEnabledReceivers(segment, enabledReceiversBySegment) {
	const enabledReceivers = new Set();
	for (const previousSegment of segment.prevSegments) {
		for (const receiver of enabledReceiversBySegment.get(previousSegment) ?? []) {
			enabledReceivers.add(receiver);
		}
	}

	return enabledReceivers;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const contextTracker = createContextTracker(imports, {trackHooks: true});
	const trackedCallbacks = new WeakSet();
	const skippedCallbacks = new WeakSet();
	const contextHookVariables = new Set();
	const codePathStack = [];
	const trackCallbacks = node => {
		const callback = getTestCallback(node);
		if (callback && isSkippedTestCall(node, sourceCode)) {
			skippedCallbacks.add(callback);
		}

		const isInSkippedCallback = isInsideSkippedCallback(node, skippedCallbacks);
		const contextHookCallback = getContextHookCallback(node, contextTracker);
		if (
			contextHookCallback
			&& !isInSkippedCallback
			&& getEnclosingFunction(node) === contextTracker.currentCallback()
		) {
			const parameter = contextHookCallback.params[0];
			if (parameter?.type === 'Identifier') {
				const variable = findVariable(sourceCode.getScope(parameter), parameter);
				if (variable) {
					contextHookVariables.add(variable);
				}
			}

			trackedCallbacks.add(contextHookCallback);
		}

		contextTracker.update(node);
		const currentCallback = contextTracker.currentCallback();
		if (
			currentCallback
			&& !isInSkippedCallback
			&& !skippedCallbacks.has(currentCallback)
		) {
			trackedCallbacks.add(currentCallback);
		}

		return isInSkippedCallback;
	};

	context.on('onCodePathStart', (codePath, node) => {
		codePathStack.push({
			node,
			isTracked: node.type === 'Program' || trackedCallbacks.has(node),
			activeSegments: new Set(),
			enabledReceiversBySegment: new Map(),
		});
	});

	context.on('onCodePathEnd', () => {
		codePathStack.pop();
	});

	context.on('onCodePathSegmentStart', segment => {
		const codePath = codePathStack.at(-1);
		if (!codePath?.isTracked) {
			return;
		}

		codePath.enabledReceiversBySegment.set(segment, getEnabledReceivers(segment, codePath.enabledReceiversBySegment));
		codePath.activeSegments.add(segment);
	});

	context.on('onCodePathSegmentEnd', segment => {
		codePathStack.at(-1)?.activeSegments.delete(segment);
	});

	context.on('CallExpression', node => {
		trackCallbacks(node);

		const codePath = codePathStack.at(-1);
		if (
			!codePath?.isTracked
			|| (codePath.node.type !== 'Program' && getEnclosingFunction(node) !== codePath.node)
		) {
			return;
		}

		const action = getMockAction(node, contextTracker, contextHookVariables, imports);
		if (!action) {
			return;
		}

		let isDuplicate = false;
		for (const segment of codePath.activeSegments) {
			const enabledReceivers = codePath.enabledReceiversBySegment.get(segment);
			if (action.method === 'enable') {
				isDuplicate ||= enabledReceivers.has(action.receiver);
				enabledReceivers.add(action.receiver);
			} else {
				enabledReceivers.delete(action.receiver);
			}
		}

		if (isDuplicate) {
			return {
				node,
				messageId: MESSAGE_ID,
			};
		}
	});

	context.onExit('CallExpression', node => {
		contextTracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow enabling mock timers more than once without resetting them.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

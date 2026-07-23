import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import {
	createContextTracker,
	findOptionsProperty,
	getContextParameterIdentifier,
	getHookCallback,
	getSubtestReceiver,
	getTestCallback,
	getTestOptions,
	HOOK_FUNCTIONS,
	isGlobalMock,
	MODIFIERS,
	parseTestCall,
	resolveImports,
} from './utils/node-test.js';
import {getEnclosingFunction} from './utils/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-duplicate-mock-timers-enable';
const messages = {
	[MESSAGE_ID]: '`mock.timers.enable()` is already active on this mock tracker. Call `reset()` before enabling mock timers again.',
};

const GLOBAL_RECEIVER = Symbol('global receiver');

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
	const method = callee.type === 'MemberExpression' && !callee.computed && !callee.optional
		? getStaticPropertyName(callee.property)
		: undefined;
	if (
		!method
		|| !HOOK_FUNCTIONS.has(method)
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
	return Boolean(staticValue?.value);
}

function isInsideSkippedCallback(node, skippedCallbacks) {
	// Walking to the root is the expensive part of visiting a call, and most files skip nothing.
	if (skippedCallbacks.size === 0) {
		return false;
	}

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
	const skippedCallbacks = new Set();
	const contextHookVariables = new Set();
	const codePathStack = [];
	const markSkippedCallback = (node, parsed, isSubtest, callback) => {
		const isTestOrSuite = (parsed?.kind === 'test' || parsed?.kind === 'suite')
			&& parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name));
		if (
			callback
			&& (isTestOrSuite || isSubtest)
			&& isSkippedTestCall(node, sourceCode)
		) {
			skippedCallbacks.add(callback);
		}
	};

	const trackContextHookCallback = (node, isInSkippedCallback) => {
		const callback = getContextHookCallback(node, contextTracker);
		if (
			!callback
			|| isInSkippedCallback
			|| getEnclosingFunction(node) !== contextTracker.currentCallback()
		) {
			return;
		}

		const identifier = getContextParameterIdentifier(callback.params[0]);
		if (identifier?.type === 'Identifier') {
			const variable = findVariable(sourceCode.getScope(identifier), identifier);
			if (variable) {
				contextHookVariables.add(variable);
			}
		}

		trackedCallbacks.add(callback);
	};

	const trackCallbacks = node => {
		const parsed = parseTestCall(node, imports);
		const subtestReceiver = getSubtestReceiver(node);
		const isSubtest = contextTracker.isContextIdentifier(subtestReceiver);
		const callback = getTestCallback(node);
		markSkippedCallback(node, parsed, isSubtest, callback);
		const isInSkippedCallback = isInsideSkippedCallback(node, skippedCallbacks);
		trackContextHookCallback(node, isInSkippedCallback);

		if (
			callback
			&& parsed?.kind === 'suite'
			&& parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name))
			&& !isInSkippedCallback
			&& !skippedCallbacks.has(callback)
		) {
			trackedCallbacks.add(callback);
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

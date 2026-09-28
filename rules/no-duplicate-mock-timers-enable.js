import {findVariable} from '@eslint-community/eslint-utils';
import {
	createContextTracker,
	getFirstContextParameter,
	getHookCallback,
	getOutOfLineCallbackCall,
	getParentCallExpression,
	getSubtestReceiver,
	getTestCallback,
	HOOK_FUNCTIONS,
	isGetTestContextCall,
	isGlobalMock,
	MODIFIERS,
	parseTestCall,
	resolveImports,
} from './utils/node-test.js';
import {isSkippedTestCall, isInsideSkippedCallback} from './shared/skipped-test.js';
import {getEnclosingFunction} from './utils/index.js';
import {isFunction} from './ast/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-duplicate-mock-timers-enable';
const messages = {
	[MESSAGE_ID]: '`mock.timers.enable()` is already active on this mock tracker. Call `reset()` before enabling mock timers again.',
};

const GLOBAL_RECEIVER = Symbol('global receiver');
// `getTestContext()` outside any tracked callback, where there is no context parameter to stand in
// for it. Two such calls still name the same tracker.
const ROOT_CONTEXT_RECEIVER = Symbol('root context receiver');

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

	// `getTestContext()` returns the context the enclosing callbacks were given, so it names the
	// same tracker as the context parameter.
	if (isGetTestContextCall(context, imports)) {
		return contextTracker.currentContextVariable() ?? ROOT_CONTEXT_RECEIVER;
	}

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

/*
The receivers enabled on some path that reaches `segment`: the union over its predecessors, so a reset has to run on every path before another `enable()` is allowed.

A predecessor that has not started yet contributes nothing on its own, which is what makes a `for…of`
or `for…in` body miss the state from before the loop: ESLint emits the body first, with the back edges
as its predecessors, and those have not been emitted at that point. Their own predecessors are known
though, so the walk continues through them, stopping at a segment already visited.
*/
function getEnabledReceivers(segment, enabledReceiversBySegment) {
	const enabledReceivers = new Set();
	const visited = new Set();

	const collect = current => {
		if (!current || visited.has(current)) {
			return;
		}

		visited.add(current);
		if (enabledReceiversBySegment.has(current)) {
			for (const receiver of enabledReceiversBySegment.get(current)) {
				enabledReceivers.add(receiver);
			}

			return;
		}

		for (const previousSegment of current.prevSegments) {
			collect(previousSegment);
		}
	};

	for (const previousSegment of segment.prevSegments) {
		collect(previousSegment);
	}

	return enabledReceivers;
}

/*
A class static field initializer runs when the class is defined, like a static block does, and ESLint
gives it its own code path whose node is the initialized expression itself.
*/
function isStaticFieldInitializer(node) {
	const {parent} = node;
	// A function value is its own code path, and its body runs when it is called, not when the class is defined.
	return parent?.type === 'PropertyDefinition' && parent.static && parent.value === node && !isFunction(node);
}

/*
A class static block and a static field initializer are not a scope of their own: they run as part of
the flow of the code that declares the class, in a code path of their own only because ESLint
analyzes them separately.
*/
function isStaticPath(node) {
	return node.type === 'StaticBlock' || isStaticFieldInitializer(node);
}

/*
Whether a code path runs while the file is being loaded, where the mock timers are enabled for every
test in it: the module body, and a class static block or static field initializer that the module body
declares. A class declared inside a test, suite or hook callback is defined while that callback runs
instead, which is not load time.
*/
function isLoadTimeCodePath(node, contextTracker) {
	if (node.type === 'Program') {
		return true;
	}

	return isStaticPath(node) && !contextTracker.isTrackedCallback(getEnclosingFunction(node));
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
	const isSkippedRegistration = call => {
		const parsed = parseTestCall(call, imports);
		const isTestOrSuite = (parsed?.kind === 'test' || parsed?.kind === 'suite')
			&& parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name));
		return (isTestOrSuite || contextTracker.isContextIdentifier(getSubtestReceiver(call)))
			&& isSkippedTestCall(call, parsed, context);
	};

	/*
	Whether a registration that skips its callback encloses `node` through a body named out of line, as in `test.skip('a', body)`. The body is visited where it is declared, outside the call's frame and often before the call, so the calls are read from the code instead: each function's own call, inline or out of line, then onward from that call.
	*/
	const isInsideSkippedOutOfLineBody = node => {
		const visited = new Set();
		for (let current = node.parent; current; current = current.parent) {
			if (!isFunction(current) || visited.has(current)) {
				continue;
			}

			// Two bodies that register each other would otherwise lead the walk around forever.
			visited.add(current);
			const parentCall = getParentCallExpression(current);
			const inlineCall = parentCall && getTestCallback(parentCall, imports) === current ? parentCall : undefined;
			const call = inlineCall ?? getOutOfLineCallbackCall(current, context, imports, contextTracker.isContextReceiver);
			if (call && isSkippedRegistration(call)) {
				return true;
			}

			if (call && !inlineCall) {
				current = call;
			}
		}

		return false;
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

		const identifier = getFirstContextParameter(callback.params);
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
		const callback = getTestCallback(node);
		if (callback && isSkippedRegistration(node)) {
			skippedCallbacks.add(callback);
		}

		const isInSkippedCallback = isInsideSkippedCallback(node, skippedCallbacks)
			|| (callback !== undefined && isInsideSkippedOutOfLineBody(node));
		// The calls inside a callback that never runs never run either, which the ancestor check then sees.
		if (isInSkippedCallback && callback) {
			skippedCallbacks.add(callback);
		}

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
		const isLoadTime = isLoadTimeCodePath(node, contextTracker);
		codePathStack.push({
			node,
			// A static block or static field initializer declared in a callback the runner executes
			// belongs to that callback, so it is tracked with it.
			isTracked: isLoadTime || trackedCallbacks.has(node) || (isStaticPath(node) && trackedCallbacks.has(getEnclosingFunction(node))),
			isLoadTime,
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
			|| (!isStaticPath(codePath.node) && !codePath.isLoadTime && getEnclosingFunction(node) !== codePath.node)
		) {
			return;
		}

		const action = getMockAction(node, contextTracker, contextHookVariables, imports);
		if (!action) {
			return;
		}

		// A static block or static field initializer runs as part of the flow of the code that declares
		// the class, so the trackers it enables are enabled for that code too. A tracked callback runs
		// at a time of its own, so nothing outside it shares the state, and a helper function is not
		// tracked at all.
		const codePaths = [codePath];
		if (isStaticPath(codePath.node)) {
			for (let index = codePathStack.length - 2; index >= 0; index--) {
				const enclosing = codePathStack[index];
				if (!enclosing.isTracked) {
					break;
				}

				codePaths.push(enclosing);
				if (!enclosing.isLoadTime) {
					break;
				}
			}
		}

		let isDuplicate = false;
		for (const path of codePaths) {
			for (const segment of path.activeSegments) {
				const enabledReceivers = path.enabledReceiversBySegment.get(segment);
				if (action.method === 'enable') {
					// Enabling through another receiver, the global `mock.timers` or a context's
					// `t.mock.timers`, throws `ERR_INVALID_STATE` only when both calls mock `Date`, which
					// depends on their `apis`, so only the same receiver counts as a duplicate. A `reset()`
					// only clears the receiver it is called on, so a receiver enabled earlier stays enabled.
					isDuplicate ||= enabledReceivers.has(action.receiver);
					enabledReceivers.add(action.receiver);
				} else {
					enabledReceivers.delete(action.receiver);
				}
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

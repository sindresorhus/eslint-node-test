import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getCalleeChain,
	getHookCallback,
	getTestCallback,
	getParentCallExpression,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	getTestOptions,
	getFirstContextParameter,
	findEnabledOptionsProperty,
	getContextHookName,
	isHookMemberTestCall,
	isSubtestCall,
	MODIFIERS,
	getImportSpecifierName,
} from './utils/node-test.js';
import {hasEnabledSkipOption, hasSkippedSuiteOption} from './shared/skipped-test.js';
import {getEnclosingFunction, unwrapExpression} from './utils/index.js';
import {functionTypes, isFunction} from './ast/index.js';

const MESSAGE_ID = 'no-sleep-in-test';

const messages = {
	[MESSAGE_ID]: 'Do not sleep in tests with `setTimeout`. Await the real signal or use mock timers instead.',
};

const CALLBACK_TIMER_MODULES = new Set(['node:timers', 'timers']);
const PROMISE_TIMER_MODULES = new Set(['node:timers/promises', 'timers/promises']);
const ACTIVE_TEST_MODIFIERS = new Set(['only', 'todo']);
const CONTEXT_HOOKS = new Set(['before', 'beforeEach', 'after', 'afterEach']);

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

function hasInactiveTestOptions(node, context) {
	// The same check the shared skip detection uses: only a truthy `skip` stops the body from running.
	// For a test, `{skip: 0}` reports the test as skipped but still runs its own body, so a sleep in it still costs the time. A suite is different, see `hasSkippedSuiteOption`.
	return hasEnabledSkipOption(getTestOptions(node), context);
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

function hasInactiveParsedOptions(node, parsed, context) {
	const kind = getParsedKind(parsed);
	if (kind === 'suite') {
		return hasSkippedSuiteOption(getTestOptions(node), context);
	}

	return kind !== 'hook' && hasInactiveTestOptions(node, context);
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
			if (specifier.type === 'ImportSpecifier' && getImportSpecifierName(specifier) === 'setTimeout') {
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
		&& unwrapExpression(node.object)?.type === 'Identifier'
		&& namespace.has(findVariable(sourceCode.getScope(node.object), unwrapExpression(node.object)))
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
		// A defaulted parameter (`(t = getTestContext())`) declares the context just the same.
		const parameter = getFirstContextParameter(callback.params);
		if (!parameter) {
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

	// Whether the call sits directly in the tracked test's own callback, which is the scope a
	// `getTestContext()` call resolves against.
	const isInCurrentTestContext = node => getEnclosingFunction(node) === testStack.at(-1)?.callback;

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
		if (receiver === undefined) {
			// `getTestContext().test(…)` names the context this rule is already tracking, so it
			// needs no receiver to match against.
			return isSubtestCall(node, imports) && isInCurrentTestContext(node);
		}

		return receiver.type === 'Identifier' && isCurrentTestContextReceiver(node, receiver);
	};

	const isCurrentTestContextHookCall = node => {
		const receiver = getContextHookReceiver(node);
		if (receiver === undefined) {
			// Likewise for `getTestContext().beforeEach(…)`.
			return getContextHookName(node) !== undefined && isInCurrentTestContext(node);
		}

		return isCurrentTestContextReceiver(node, receiver);
	};

	const isActiveSubtestCall = node => isCurrentTestContextSubtestCall(node)
		&& areActiveModifiers(getSubtestModifiers(node))
		&& !hasInactiveTestOptions(node, context);

	const isInactiveSubtestCall = node => isCurrentTestContextSubtestCall(node)
		&& (
			!areActiveModifiers(getSubtestModifiers(node))
			|| hasInactiveTestOptions(node, context)
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
				&& !hasInactiveParsedOptions(node, parsed, context)
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
				|| hasInactiveParsedOptions(node, parsed, context)
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
		// A skipped registration whose body is named out of line is not on the stack, so it is read from the code.
		if (boundaryCallback && !isInsideSkippedRegistration(node)) {
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

	// Whether a registration call runs its callback, read the way the inline path reads it: its
	// modifiers and its options. A context hook has neither. `TestContext#test` has no `skip`, `todo` or `only` member, so any of them throws; they are read the way the inline path reads them, so only `t.test.skip(…)` counts as not running.
	const runsCallback = call => {
		const parsed = parseTestCall(call, imports);
		if (parsed) {
			return areActiveModifiers(getParsedModifiers(parsed)) && !hasInactiveParsedOptions(call, parsed, context);
		}

		return getContextHookName(call) !== undefined
			|| (areActiveModifiers(getSubtestModifiers(call)) && !hasInactiveTestOptions(call, context));
	};

	// Whether a registration around the call skips the callback the call sits in, like
	// `describe.skip('s', () => { test('a', body); })`. The inline path learns this from the stack, but
	// an out-of-line body is visited where it is declared, so the call's own ancestors are read instead.
	// A function named out of line (`describe.skip('s', suiteBody)`) is registered somewhere else, so the
	// walk goes on from the call that registers it.
	const isInsideSkippedRegistration = call => {
		const visited = new Set();
		for (let current = call.parent; current; current = current.parent) {
			if (!isFunction(current) || visited.has(current)) {
				continue;
			}

			// Two bodies that register each other would otherwise lead the walk around forever.
			visited.add(current);
			// The options and descriptor forms put the callback in an `fn` property, one level below the call.
			const parentCall = getParentCallExpression(current);
			const inlineRegistration = parentCall && getTestCallback(parentCall, imports) === current ? parentCall : undefined;
			const registration = inlineRegistration ?? getOutOfLineCallbackCall(current, context, imports);
			if (
				registration
				&& getRegistrationKind(registration, imports, undefined, context) !== undefined
				&& !runsCallback(registration)
			) {
				return true;
			}

			if (registration && !inlineRegistration) {
				current = registration;
			}
		}

		return false;
	};

	// A test body the call names out of line is entered where it is declared, which the call's own
	// frame does not cover, so a sleep in it sat outside every tracked scope.
	const outOfLineTestBodies = new WeakSet();

	context.on(functionTypes, node => {
		const call = getOutOfLineCallbackCall(node, context, imports);
		// The body is only ever run when the test is not skipped, exactly as the inline path checks.
		const kind = getRegistrationKind(call, imports, undefined, context);
		if ((kind !== 'test' && kind !== 'hook') || !runsCallback(call) || isInsideSkippedRegistration(call)) {
			return;
		}

		outOfLineTestBodies.add(node);
		testStack.push({callback: node, contextVariable: getContextVariable(node)});
	});

	context.onExit(functionTypes, node => {
		if (outOfLineTestBodies.delete(node)) {
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

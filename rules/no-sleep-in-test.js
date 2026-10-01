import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getCalleeChain,
	getTestCallback,
	getParentCallExpression,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	getTestOptions,
	getContextHookName,
	getImportSpecifierName,
	nearestTestCallbackKind,
} from './utils/node-test.js';
import {hasEnabledSkipOption} from './shared/skipped-test.js';
import {unwrapExpression} from './utils/index.js';
import {isFunction} from './ast/index.js';

const MESSAGE_ID = 'no-sleep-in-test';

const messages = {
	[MESSAGE_ID]: 'Do not sleep in tests with `setTimeout`. Await the real signal or use mock timers instead.',
};

const CALLBACK_TIMER_MODULES = new Set(['node:timers', 'timers']);
const PROMISE_TIMER_MODULES = new Set(['node:timers/promises', 'timers/promises']);
const ACTIVE_TEST_MODIFIERS = new Set(['only', 'todo']);

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
	// The same check the shared skip detection uses: only a truthy `skip` stops the body from running. `{skip: 0}` reports the test as skipped but still runs its own body, so a sleep in it still costs the time. A suite reads `skip` the same way, see `isSkippedTestCall`.
	return hasEnabledSkipOption(getTestOptions(node), context);
}

function getSubtestModifiers(node) {
	const {members = []} = getCalleeChain(node.callee) ?? {};
	return members?.[0]?.name === 'test' ? members.slice(1) : [];
}

function hasInactiveParsedOptions(node, parsed, context) {
	return parsed.kind !== 'hook' && hasInactiveTestOptions(node, context);
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

	// Whether a registration call runs its callback, read from its modifiers and its options. A context hook has neither. `TestContext#test` has no `skip`, `todo` or `only` member, so any of them throws; they are read the way the modifiers of an imported `test` are, so only `t.test.skip(…)` counts as not running.
	const runsCallback = call => {
		const parsed = parseTestCall(call, imports);
		if (parsed) {
			return areActiveModifiers(parsed.modifiers) && !hasInactiveParsedOptions(call, parsed, context);
		}

		return getContextHookName(call) !== undefined
			|| (areActiveModifiers(getSubtestModifiers(call)) && !hasInactiveTestOptions(call, context));
	};

	// Whether a registration around the call skips the callback the call sits in, like `describe.skip('s', () => { test('a', body); })`. The call's own ancestors are read, which also covers an out-of-line body, visited where it is declared. A function named out of line (`describe.skip('s', suiteBody)`) is registered somewhere else, so the walk goes on from the call that registers it.
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
				&& getRegistrationKind(registration, imports, context) !== undefined
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

	// Whether the node sits directly in a test or hook body that runs. The nearest enclosing function decides, inline or named out of line, and a skipped registration around it stops the body from running.
	const isInsideTestCallback = node => {
		const kind = nearestTestCallbackKind(node, imports, context);
		return (kind === 'test' || kind === 'hook') && !isInsideSkippedRegistration(node);
	};

	context.on('NewExpression', node => {
		// The sleep shape is cheap to check, so it runs before the walk up the enclosing functions.
		if (!isSleepPromise(node, timerImports) || !isInsideTestCallback(node)) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
		};
	});

	context.on('CallExpression', node => {
		if (!isPromiseTimerSleep(node, timerImports) || !isInsideTestCallback(node)) {
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

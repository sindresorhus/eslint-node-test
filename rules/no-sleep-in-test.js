import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	getImportSpecifierName,
	nearestTestCallbackKind,
} from './utils/node-test.js';
import {isInsideSkippedRegistration} from './shared/skipped-test.js';
import {isGlobalThisMember, isUnshadowedGlobal, unwrapExpression} from './utils/index.js';
import {isFunction, isMemberExpression} from './ast/index.js';

const MESSAGE_ID = 'no-sleep-in-test';

const messages = {
	[MESSAGE_ID]: 'Do not sleep in tests with `setTimeout`. Await the real signal or use mock timers instead.',
};

const CALLBACK_TIMER_MODULES = new Set(['node:timers', 'timers']);
const PROMISE_TIMER_MODULES = new Set(['node:timers/promises', 'timers/promises']);

function isGlobalReference(sourceCode, node, name) {
	return isUnshadowedGlobal(unwrapExpression(node), name, {sourceCode});
}

function isSameReference(sourceCode, node, variable) {
	node = unwrapExpression(node);
	return node?.type === 'Identifier'
		&& findVariable(sourceCode.getScope(node), node) === variable;
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

	if (!isMemberExpression(node, 'setTimeout')) {
		return false;
	}

	const object = unwrapExpression(node.object);
	return object?.type === 'Identifier'
		&& namespace.has(findVariable(sourceCode.getScope(object), object));
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
		|| isGlobalThisMember(node, 'setTimeout', {sourceCode: timerImports.sourceCode})
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

	// Whether the node sits directly in a test or hook body that runs. The nearest enclosing function decides, inline or named out of line, and a skipped registration around it stops the body from running.
	const isInsideTestCallback = node => {
		const kind = nearestTestCallbackKind(node, imports, context);
		// `{skip: 0}` reports the test as skipped but still runs its own body, so a sleep in it still costs the time.
		return (kind === 'test' || kind === 'hook') && !isInsideSkippedRegistration(node, imports, context);
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

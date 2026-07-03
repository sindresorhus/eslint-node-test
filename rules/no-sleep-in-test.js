import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getSubtestReceiver,
	MODIFIERS,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {getEnclosingFunction} from './utils/index.js';
import isFunction from './ast/is-function.js';

const MESSAGE_ID = 'no-sleep-in-test';

const messages = {
	[MESSAGE_ID]: 'Do not sleep in tests with `setTimeout`. Await the real signal or use mock timers instead.',
};

const TIMER_MODULES = new Set(['node:timers', 'timers']);

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

function isGlobalThisSetTimeout(sourceCode, node) {
	node = unwrapExpression(node);
	return node?.type === 'MemberExpression'
		&& !node.computed
		&& (
			isGlobalReference(sourceCode, node.object, 'globalThis')
			|| isGlobalReference(sourceCode, node.object, 'global')
		)
		&& isIdentifierReference(node.property, 'setTimeout');
}

function getTimerImportBindings(sourceCode) {
	const named = new Set();
	const namespace = new Set();

	for (const node of sourceCode.ast.body) {
		if (node.type !== 'ImportDeclaration' || !TIMER_MODULES.has(node.source.value)) {
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
					named.add(variable);
				}
			}

			if (specifier.type === 'ImportNamespaceSpecifier') {
				const variable = findVariable(sourceCode.getScope(specifier.local), specifier.local);
				if (variable) {
					namespace.add(variable);
				}
			}
		}
	}

	return {named, namespace, sourceCode};
}

function isImportedTimerSetTimeout(node, timerImports) {
	node = unwrapExpression(node);

	if (node?.type === 'Identifier') {
		return timerImports.named.has(findVariable(timerImports.sourceCode.getScope(node), node));
	}

	return node?.type === 'MemberExpression'
		&& !node.computed
		&& node.object.type === 'Identifier'
		&& timerImports.namespace.has(findVariable(timerImports.sourceCode.getScope(node.object), node.object))
		&& isIdentifierReference(node.property, 'setTimeout');
}

function isSetTimeoutCallee(node, timerImports) {
	node = unwrapExpression(node);
	return isGlobalReference(timerImports.sourceCode, node, 'setTimeout')
		|| isGlobalThisSetTimeout(timerImports.sourceCode, node)
		|| isImportedTimerSetTimeout(node, timerImports);
}

function getStatementExpression(node) {
	if (node.type === 'ExpressionStatement') {
		return node.expression;
	}

	if (node.type === 'ReturnStatement') {
		return node.argument;
	}
}

function bodyContainsExpression(body, predicate) {
	if (body.type !== 'BlockStatement') {
		return predicate(body);
	}

	return body.body.some(statement => predicate(getStatementExpression(statement)));
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

	return bodyContainsExpression(node.body, expression => expressionCallsResolver(expression, resolverVariable, sourceCode));
}

function isResolverArgument(node, resolverVariable, sourceCode) {
	node = unwrapExpression(node);
	return isSameReference(sourceCode, node, resolverVariable) || functionCallsResolver(node, resolverVariable, sourceCode);
}

function isSleepSetTimeoutCall(node, resolverVariable, timerImports) {
	node = unwrapExpression(node);
	return node?.type === 'CallExpression'
		&& node.arguments.length >= 2
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
	const resolver = isFunction(executorFunction) ? executorFunction.params[0] : undefined;
	if (resolver?.type !== 'Identifier') {
		return false;
	}

	const resolverVariable = findVariable(timerImports.sourceCode.getScope(resolver), resolver);
	if (!resolverVariable) {
		return false;
	}

	return bodyContainsExpression(executorFunction.body, expression => isSleepSetTimeoutCall(expression, resolverVariable, timerImports));
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const timerImports = getTimerImportBindings(context.sourceCode);
	const testStack = [];
	const trackedCalls = new Set();
	const {sourceCode} = context;

	const getContextVariable = callback => {
		const [parameter] = callback.params;
		if (parameter?.type !== 'Identifier') {
			return;
		}

		return findVariable(sourceCode.getScope(parameter), parameter);
	};

	const isSubtestCall = node => {
		const receiver = getSubtestReceiver(node);
		if (receiver?.type !== 'Identifier') {
			return false;
		}

		const receiverVariable = findVariable(sourceCode.getScope(receiver), receiver);
		return testStack.some(test => test.contextVariable && test.contextVariable === receiverVariable);
	};

	const getScopeBoundaryCallback = node => {
		const parsed = parseTestCall(node, imports);
		if (parsed) {
			return (
				(parsed.kind === 'test' || parsed.kind === 'hook')
				&& parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name))
			)
				? getTestCallback(node)
				: undefined;
		}

		return isSubtestCall(node) ? getTestCallback(node) : undefined;
	};

	const isInsideTestCallback = node => {
		const testCallback = testStack.at(-1)?.callback;
		return testCallback ? getEnclosingFunction(node) === testCallback : false;
	};

	context.on('CallExpression', node => {
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
		testStack.pop();
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
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow sleeping in tests with `setTimeout`.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

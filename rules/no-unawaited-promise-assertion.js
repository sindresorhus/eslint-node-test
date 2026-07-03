import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	parseAssertionCall,
	getSubtestReceiver,
	MODIFIERS,
} from './utils/node-test.js';
import {isFunction} from './ast/index.js';
import {getEnclosingFunction, unwrapTypeScriptExpression, isTypeScriptExpressionWrapper} from './utils/index.js';

const MESSAGE_ID = 'no-unawaited-promise-assertion';

const PROMISE_METHODS = new Set(['then', 'catch', 'finally']);

const messages = {
	[MESSAGE_ID]: 'Assertion in a floating `{{method}}()` callback is not awaited by the test. Await or return the Promise chain.',
};

function unwrapChainExpression(node) {
	node = unwrapTypeScriptExpression(node);
	return node?.type === 'ChainExpression' ? node.expression : node;
}

function getCalleeRoot(node) {
	while (
		node.type === 'MemberExpression'
		&& !node.computed
	) {
		node = node.object;
	}

	return node.type === 'Identifier' ? node : undefined;
}

function getFloatingExpression(node) {
	let expression = node;
	let {parent} = node;

	while (parent?.type === 'ChainExpression' || isTypeScriptExpressionWrapper(parent)) {
		expression = parent;
		parent = parent.parent;
	}

	if (parent?.type === 'UnaryExpression' && parent.operator === 'void') {
		const unaryExpression = parent;
		parent = parent.parent;

		if (parent?.type === 'ExpressionStatement') {
			return {
				expression: unaryExpression.argument,
				canFix: false,
			};
		}

		return undefined;
	}

	if (parent?.type !== 'ExpressionStatement') {
		return undefined;
	}

	return {
		expression,
		canFix: true,
	};
}

function getPromiseChainCalls(node) {
	const calls = [];
	node = unwrapChainExpression(node);

	while (node?.type === 'CallExpression') {
		const callee = unwrapChainExpression(node.callee);
		if (
			callee?.type !== 'MemberExpression'
			|| callee.computed
			|| callee.property.type !== 'Identifier'
		) {
			break;
		}

		if (!PROMISE_METHODS.has(callee.property.name)) {
			if (
				calls.length > 0
				&& unwrapChainExpression(callee.object)?.type === 'CallExpression'
			) {
				return [];
			}

			return calls;
		}

		calls.push({
			node,
			method: callee.property.name,
		});

		node = unwrapChainExpression(callee.object);
	}

	return calls;
}

function getPromiseCallbackArguments(call) {
	const {method} = call;
	const argumentIndexes = method === 'then' ? [0, 1] : [0];

	return argumentIndexes
		.map(index => unwrapTypeScriptExpression(call.node.arguments[index]))
		.filter(argument => argument && isFunction(argument));
}

function getContextParameter(callback) {
	const parameter = callback.params[0];
	return parameter?.type === 'Identifier' ? parameter : undefined;
}

function getContextAssertReceiver(node) {
	const {callee} = node;
	if (
		callee.type === 'MemberExpression'
		&& callee.object.type === 'MemberExpression'
		&& !callee.object.computed
		&& callee.object.object.type === 'Identifier'
		&& callee.object.property.type === 'Identifier'
		&& callee.object.property.name === 'assert'
	) {
		return callee.object.object;
	}

	return undefined;
}

function isTrackedContextAssertCall(node, contextParameters, sourceCode) {
	const receiver = getContextAssertReceiver(node);
	if (!receiver) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(receiver), receiver);
	return variable?.identifiers.some(identifier => contextParameters.includes(identifier)) === true;
}

function isTrackedSubtestCall(node, contextParameters, sourceCode) {
	const receiver = getSubtestReceiver(node);
	if (!receiver) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(receiver), receiver);
	return variable?.identifiers.some(identifier => contextParameters.includes(identifier)) === true;
}

function isImportBinding(identifier, sourceCode) {
	const variable = findVariable(sourceCode.getScope(identifier), identifier);
	return variable?.defs.some(definition => definition.type === 'ImportBinding') === true;
}

function isImportedTestCall(node, sourceCode) {
	const root = getCalleeRoot(node.callee);
	return root && isImportBinding(root, sourceCode);
}

function hasOnlyTestModifiers(parsed) {
	return parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name));
}

function getImportedAssertReference(node, imports) {
	const {callee} = node;

	if (
		callee.type === 'Identifier'
		&& (
			imports.assertNamed.has(callee.name)
			|| imports.assertNamespace.has(callee.name)
		)
	) {
		return callee;
	}

	if (
		callee.type === 'MemberExpression'
		&& callee.object.type === 'Identifier'
		&& imports.assertNamespace.has(callee.object.name)
	) {
		return callee.object;
	}

	return undefined;
}

function parseScopedAssertionCall(node, imports, contextParameters, sourceCode) {
	const parsed = parseAssertionCall(node, imports);
	if (!parsed) {
		return undefined;
	}

	if (getContextAssertReceiver(node)) {
		return isTrackedContextAssertCall(node, contextParameters, sourceCode) ? parsed : undefined;
	}

	const importedAssertReference = getImportedAssertReference(node, imports);
	return importedAssertReference && isImportBinding(importedAssertReference, sourceCode) ? parsed : undefined;
}

function findAssertion(node, state) {
	const {
		imports,
		contextParameters,
		sourceCode,
		visitorKeys,
	} = state;

	node = unwrapTypeScriptExpression(node);
	if (!node) {
		return undefined;
	}

	if (isFunction(node)) {
		return undefined;
	}

	if (
		node.type === 'CallExpression'
		&& parseScopedAssertionCall(node, imports, contextParameters, sourceCode)
	) {
		return node;
	}

	for (const key of visitorKeys[node.type] ?? []) {
		const child = node[key];
		for (const childNode of Array.isArray(child) ? child : [child]) {
			const assertion = childNode?.type && findAssertion(childNode, state);
			if (assertion) {
				return assertion;
			}
		}
	}

	return undefined;
}

function getAssertionProblems(chainCalls, state) {
	return chainCalls.flatMap(call => getPromiseCallbackArguments(call).flatMap(callback => {
		const assertion = findAssertion(callback.body, state);
		if (!assertion) {
			return [];
		}

		return [{
			node: assertion,
			messageId: MESSAGE_ID,
			data: {
				method: call.method,
			},
		}];
	}));
}

function getTestBoundaryCallback(node, imports, contextParameters, sourceCode) {
	const parsed = parseTestCall(node, imports);
	if (parsed) {
		if (parsed.kind !== 'test' && parsed.kind !== 'hook') {
			return undefined;
		}

		if (!hasOnlyTestModifiers(parsed)) {
			return undefined;
		}

		if (!isImportedTestCall(node, sourceCode)) {
			return undefined;
		}

		return getTestCallback(node);
	}

	return isTrackedSubtestCall(node, contextParameters, sourceCode) ? getTestCallback(node) : undefined;
}

function hasStaticBlockBetween(node, boundary) {
	for (let current = node; current && current !== boundary; current = current.parent) {
		if (current.type === 'StaticBlock') {
			return true;
		}
	}

	return false;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {sourceCode} = context;
	const {visitorKeys} = sourceCode;
	const callbackStack = [];

	context.on('CallExpression', node => {
		const contextParameters = callbackStack.map(frame => frame.contextParameter).filter(Boolean);
		const boundaryCallback = getTestBoundaryCallback(node, imports, contextParameters, sourceCode);

		if (boundaryCallback) {
			callbackStack.push({
				node,
				callback: boundaryCallback,
				contextParameter: getContextParameter(boundaryCallback),
			});
			return;
		}

		const activeCallback = callbackStack.at(-1)?.callback;
		if (!activeCallback || getEnclosingFunction(node) !== activeCallback) {
			return;
		}

		const floatingExpression = getFloatingExpression(node);
		if (!floatingExpression) {
			return;
		}

		const chainCalls = getPromiseChainCalls(floatingExpression.expression);
		if (chainCalls.length === 0) {
			return;
		}

		const problems = getAssertionProblems(chainCalls, {
			imports,
			contextParameters,
			sourceCode,
			visitorKeys,
		});
		if (problems.length === 0) {
			return;
		}

		if (
			floatingExpression.canFix
			&& activeCallback.async
			&& !hasStaticBlockBetween(floatingExpression.expression, activeCallback)
		) {
			problems[0].fix = fixer => fixer.insertTextBefore(floatingExpression.expression, 'await ');
		}

		return problems;
	});

	context.onExit('CallExpression', node => {
		if (callbackStack.at(-1)?.node === node) {
			callbackStack.pop();
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow assertions inside unawaited Promise callbacks.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

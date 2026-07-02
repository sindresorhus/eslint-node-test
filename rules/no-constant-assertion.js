import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import {
	MODIFIERS,
	resolveImports,
	parseAssertionCall,
	parseTestCall,
	getSubtestReceiver,
	getTestCallback,
} from './utils/node-test.js';
import {isRegexLiteral} from './ast/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-constant-assertion';

const messages = {
	[MESSAGE_ID]: 'This assertion has a constant outcome, so it does not test code behavior.',
};

const COMPARISON_METHODS = new Set([
	'equal',
	'notEqual',
	'strictEqual',
	'notStrictEqual',
	'deepEqual',
	'notDeepEqual',
	'deepStrictEqual',
	'notDeepStrictEqual',
]);

const MATCH_METHODS = new Set([
	'match',
	'doesNotMatch',
]);

function isStaticArgument(node, sourceCode) {
	if (!node || node.type === 'SpreadElement') {
		return false;
	}

	node = unwrapTypeScriptExpression(node);

	return getStaticValue(node, sourceCode.getScope(node)) !== null;
}

function areStaticArguments(nodes, sourceCode) {
	return nodes.every(node => isStaticArgument(node, sourceCode));
}

function isStaticRegexLiteral(node) {
	if (!node || node.type === 'SpreadElement') {
		return false;
	}

	return isRegexLiteral(unwrapTypeScriptExpression(node));
}

function isImportBindingVariable(variable) {
	return variable?.defs.some(({type}) => type === 'ImportBinding') ?? false;
}

function getCalleeRootIdentifier(node) {
	let {callee} = node;
	while (
		callee.type === 'MemberExpression'
		&& !callee.computed
	) {
		callee = callee.object;
	}

	return callee.type === 'Identifier' ? callee : undefined;
}

function isNodeTestCall(node, imports, sourceCode) {
	const parsed = parseTestCall(node, imports);
	if (
		!parsed
		|| (parsed.kind !== 'test' && parsed.kind !== 'hook')
		|| (parsed.kind === 'hook' && parsed.modifiers.length > 0)
		|| parsed.modifiers.some(modifier => !MODIFIERS.has(modifier.name))
	) {
		return false;
	}

	const root = getCalleeRootIdentifier(node);
	if (!root) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(root), root);
	return isImportBindingVariable(variable);
}

function isImportedAssertCall(node, imports, sourceCode) {
	const {callee} = node;
	if (callee.type === 'Identifier') {
		if (!imports.assertNamed.has(callee.name) && !imports.assertNamespace.has(callee.name)) {
			return false;
		}

		const variable = findVariable(sourceCode.getScope(callee), callee);
		return isImportBindingVariable(variable);
	}

	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'Identifier'
		&& imports.assertNamespace.has(callee.object.name)
	) {
		const variable = findVariable(sourceCode.getScope(callee.object), callee.object);
		return isImportBindingVariable(variable);
	}

	return false;
}

function getContextAssertReceiver(node) {
	const {callee} = node;
	if (
		callee.type !== 'MemberExpression'
		|| callee.computed
		|| callee.object.type !== 'MemberExpression'
		|| callee.object.computed
		|| callee.object.object.type !== 'Identifier'
		|| callee.object.property.type !== 'Identifier'
		|| callee.object.property.name !== 'assert'
	) {
		return undefined;
	}

	return callee.object.object;
}

function isInsideNode(node, ancestor) {
	let current = node;
	while (current) {
		if (current === ancestor) {
			return true;
		}

		current = current.parent;
	}

	return false;
}

function getContextParameterVariable(callback, sourceCode) {
	const parameter = callback.params[0];
	if (parameter?.type !== 'Identifier') {
		return undefined;
	}

	return sourceCode
		.getDeclaredVariables(callback)
		.find(variable => variable.identifiers.includes(parameter));
}

function isSubtestCall(node, activeContexts, sourceCode) {
	const receiver = getSubtestReceiver(node);
	if (!receiver) {
		return false;
	}

	const receiverVariable = findVariable(sourceCode.getScope(receiver), receiver);
	return activeContexts.some(({variable}) => receiverVariable === variable);
}

function getTestContextCallback(node, imports, activeContexts, sourceCode) {
	if (isNodeTestCall(node, imports, sourceCode) || isSubtestCall(node, activeContexts, sourceCode)) {
		return getTestCallback(node);
	}
}

function isUntrackedContextAssertCall(node, activeContexts, sourceCode) {
	const receiver = getContextAssertReceiver(node);
	if (!receiver) {
		return false;
	}

	const receiverVariable = findVariable(sourceCode.getScope(receiver), receiver);
	return activeContexts.every(({callback, variable}) =>
		!isInsideNode(receiver, callback)
		|| receiverVariable !== variable);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const {sourceCode} = context;
	const activeContexts = [];
	const trackedTestCalls = new Set();

	context.on('CallExpression', node => {
		const callback = getTestContextCallback(node, imports, activeContexts, sourceCode);
		if (callback) {
			const variable = getContextParameterVariable(callback, sourceCode);
			if (variable) {
				activeContexts.push({callback, variable});
				trackedTestCalls.add(node);
			}
		}

		const assertion = parseAssertionCall(node, imports);
		if (!assertion) {
			return;
		}

		if (getContextAssertReceiver(node)) {
			if (isUntrackedContextAssertCall(node, activeContexts, sourceCode)) {
				return;
			}
		} else if (!isImportedAssertCall(node, imports, sourceCode)) {
			return;
		}

		if (node.arguments.some(argument => argument.type === 'SpreadElement')) {
			return;
		}

		const {method} = assertion;
		const [firstArgument, secondArgument] = node.arguments;
		let isConstant = false;

		if (method === 'ok' || method === 'ifError') {
			isConstant = isStaticArgument(firstArgument, sourceCode);
		} else if (COMPARISON_METHODS.has(method)) {
			isConstant = areStaticArguments([firstArgument, secondArgument], sourceCode);
		} else if (MATCH_METHODS.has(method)) {
			isConstant = isStaticArgument(firstArgument, sourceCode) && isStaticRegexLiteral(secondArgument);
		}

		if (!isConstant) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
		};
	});

	context.onExit('CallExpression', node => {
		if (!trackedTestCalls.has(node)) {
			return;
		}

		trackedTestCalls.delete(node);
		activeContexts.pop();
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow assertions with constant outcomes.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

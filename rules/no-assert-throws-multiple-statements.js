import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseAssertionCall,
	parseTestCall,
	getTestCallback,
	getSubtestReceiver,
} from './utils/node-test.js';
import isFunction from './ast/is-function.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-assert-throws-multiple-statements';

const messages = {
	[MESSAGE_ID]: 'Keep the `{{method}}()` callback to one statement so unrelated setup errors cannot satisfy the assertion.',
};

const TARGET_METHODS = new Set(['throws', 'rejects']);

function getCalleeRootIdentifier(node) {
	let current = node;
	while (current.type === 'MemberExpression' && !current.computed) {
		current = current.object;
	}

	if (current.type === 'Identifier') {
		return current;
	}
}

function isImportBinding(identifier, sourceCode) {
	const variable = findVariable(sourceCode.getScope(identifier), identifier);

	return variable?.defs.some(({type}) => type === 'ImportBinding') === true;
}

function getImportedTestReceiver(callExpression, imports) {
	const receiver = getCalleeRootIdentifier(callExpression.callee);
	if (
		receiver
		&& (
			receiver.name === imports.namespace
			|| imports.locals.has(receiver.name)
		)
	) {
		return receiver;
	}
}

function isImportedTestCall(callExpression, imports, sourceCode) {
	const receiver = getImportedTestReceiver(callExpression, imports);

	return receiver !== undefined && isImportBinding(receiver, sourceCode);
}

function getImportedAssertReceiver(callExpression, imports) {
	const {callee} = callExpression;
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
		&& !callee.computed
		&& callee.object.type === 'Identifier'
		&& (
			imports.assertNamespace.has(callee.object.name)
			|| imports.assertNamed.get(callee.object.name) === 'strict'
		)
	) {
		return callee.object;
	}

	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'MemberExpression'
		&& !callee.object.computed
		&& callee.object.object.type === 'Identifier'
		&& callee.object.property.type === 'Identifier'
		&& callee.object.property.name === 'strict'
		&& imports.assertNamespace.has(callee.object.object.name)
	) {
		return callee.object.object;
	}
}

function getContextAssertReceiver(callee) {
	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'MemberExpression'
		&& !callee.object.computed
		&& callee.object.object.type === 'Identifier'
		&& callee.object.property.type === 'Identifier'
		&& callee.object.property.name === 'assert'
	) {
		return callee.object.object;
	}
}

function isKnownContextReceiver(receiver, contextParameters, sourceCode) {
	const variable = findVariable(sourceCode.getScope(receiver), receiver);

	return variable?.defs.some(({name}) => contextParameters.has(name)) === true;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const contextParameters = new WeakSet();

	function rememberContextParameter(node) {
		const parsed = parseTestCall(node, imports);
		const subtestReceiver = getSubtestReceiver(node);
		const isTest = parsed?.kind === 'test' && isImportedTestCall(node, imports, sourceCode);
		const isSubtest = subtestReceiver && isKnownContextReceiver(subtestReceiver, contextParameters, sourceCode);
		if (
			!isTest
			&& !isSubtest
		) {
			return;
		}

		const callback = getTestCallback(node);
		const parameter = callback?.params[0];
		if (parameter?.type === 'Identifier') {
			contextParameters.add(parameter);
		}
	}

	context.on('CallExpression', node => {
		rememberContextParameter(node);

		const parsed = parseAssertionCall(node, imports);
		if (!parsed || !TARGET_METHODS.has(parsed.method)) {
			return;
		}

		const importedAssertReceiver = getImportedAssertReceiver(node, imports);
		if (importedAssertReceiver && !isImportBinding(importedAssertReceiver, sourceCode)) {
			return;
		}

		const contextAssertReceiver = getContextAssertReceiver(node.callee);
		if (contextAssertReceiver && !isKnownContextReceiver(contextAssertReceiver, contextParameters, sourceCode)) {
			return;
		}

		const [firstArgument] = node.arguments;
		if (!firstArgument || firstArgument.type === 'SpreadElement') {
			return;
		}

		const callback = unwrapTypeScriptExpression(firstArgument);
		if (!isFunction(callback) || callback.body.type !== 'BlockStatement' || callback.body.body.length <= 1) {
			return;
		}

		return {
			node: callback.body,
			messageId: MESSAGE_ID,
			data: {method: parsed.method},
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow multiple statements in `assert.throws()`/`assert.rejects()` callbacks.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

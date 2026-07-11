import {findVariable} from '@eslint-community/eslint-utils';
import {isFunction} from './ast/index.js';
import {
	getContextParameterIdentifier,
	getSubtestReceiver,
	getTestCallback,
	MODIFIERS,
	parseTestCall,
	resolveImports,
	getContextParameterIdentifier,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'require-mock-timers-apis';
const CONTEXT_HOOKS = new Set(['before', 'beforeEach', 'after', 'afterEach']);
const TEST_MODULES = new Set(['node:test', 'test']);
const STATIC_NON_OPTIONS_VALUE_TYPES = new Set(['ArrayExpression', 'Literal', 'TemplateLiteral']);

const messages = {
	[MESSAGE_ID]: '`mock.timers.enable()` should explicitly specify the `apis` option to avoid unexpectedly mocking `Date`.',
};

function isMissingApisValue(node) {
	const expression = unwrapTypeScriptExpression(node);
	if (!expression) {
		return true;
	}

	return (
		(expression.type === 'Identifier' && expression.name === 'undefined')
		|| (expression.type === 'UnaryExpression' && expression.operator === 'void')
		|| (expression.type === 'Literal' && !expression.value)
	);
}

function isStaticNonOptionsValue(node) {
	return STATIC_NON_OPTIONS_VALUE_TYPES.has(node.type);
}

function isApisProperty(property) {
	return property.type === 'Property'
		&& !property.computed
		&& (
			(property.key.type === 'Identifier' && property.key.name === 'apis')
			|| (property.key.type === 'Literal' && property.key.value === 'apis')
		);
}

function getLastVisibleApisProperty(optionsObject) {
	for (let index = optionsObject.properties.length - 1; index >= 0; index -= 1) {
		const property = optionsObject.properties[index];
		if (property.type === 'SpreadElement') {
			return undefined;
		}

		if (isApisProperty(property)) {
			return property;
		}
	}

	return undefined;
}

function isImportedReference(node, sourceCode) {
	const variable = findVariable(sourceCode.getScope(node), node);
	return variable?.defs.some(({type}) => type === 'ImportBinding') ?? false;
}

function isMissingApisOption(callExpression) {
	const firstArgument = unwrapTypeScriptExpression(callExpression.arguments[0]);
	if (!firstArgument) {
		return true;
	}

	if (isMissingApisValue(firstArgument)) {
		return true;
	}

	if (firstArgument.type !== 'ObjectExpression') {
		return isStaticNonOptionsValue(firstArgument);
	}

	const apisProperty = getLastVisibleApisProperty(firstArgument);
	return !apisProperty || isMissingApisValue(apisProperty.value);
}

function isContextProvidingCall(testCall) {
	if (testCall.kind === 'hook') {
		return testCall.modifiers.length === 0;
	}

	return testCall.kind === 'test'
		&& testCall.modifiers.every(modifier => MODIFIERS.has(modifier.name));
}

function getContextHookReceiver(callExpression) {
	const {callee} = callExpression;
	if (
		callee.type !== 'MemberExpression'
		|| callee.computed
		|| callee.property.type !== 'Identifier'
		|| !CONTEXT_HOOKS.has(callee.property.name)
	) {
		return undefined;
	}

	const receiver = unwrapTypeScriptExpression(callee.object);
	return receiver.type === 'Identifier' ? receiver : undefined;
}

function getTestContextImportLocals(sourceCode) {
	const locals = new Set();

	for (const node of sourceCode.ast.body) {
		if (node.type !== 'ImportDeclaration' || !TEST_MODULES.has(node.source.value)) {
			continue;
		}

		for (const specifier of node.specifiers) {
			if (
				specifier.type === 'ImportSpecifier'
				&& specifier.imported.type === 'Identifier'
				&& specifier.imported.name === 'getTestContext'
			) {
				locals.add(specifier.local.name);
			}
		}
	}

	return locals;
}

function getHookCallback(callExpression) {
	const firstArgument = unwrapTypeScriptExpression(callExpression.arguments[0]);
	return isFunction(firstArgument) ? firstArgument : undefined;
}

function getLocalTestHookCall(callExpression, imports, sourceCode) {
	const callee = unwrapTypeScriptExpression(callExpression.callee);
	if (
		callee.type !== 'MemberExpression'
		|| callee.computed
		|| callee.property.type !== 'Identifier'
		|| !CONTEXT_HOOKS.has(callee.property.name)
	) {
		return undefined;
	}

	const object = unwrapTypeScriptExpression(callee.object);
	if (
		object.type !== 'Identifier'
		|| !['test', 'it'].includes(imports.locals.get(object.name))
		|| !isImportedReference(object, sourceCode)
	) {
		return undefined;
	}

	return {
		name: callee.property.name,
		kind: 'hook',
		modifiers: [],
	};
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	const testContextLocals = getTestContextImportLocals(sourceCode);
	if (!imports.isTestFile && testContextLocals.size === 0) {
		return;
	}

	const contextVariables = [];
	const pushedCalls = new Set();

	const getImportedContextCall = node => {
		const testCall = parseTestCall(node, imports);
		if (testCall !== undefined && isContextProvidingCall(testCall)) {
			return testCall;
		}

		return getLocalTestHookCall(node, imports, sourceCode);
	};

	const isSubtestCall = node => {
		const receiver = getSubtestReceiver(node);
		if (!receiver) {
			return false;
		}

		const variable = findVariable(sourceCode.getScope(receiver), receiver);
		return variable !== undefined && contextVariables.includes(variable);
	};

	const isContextHookCall = node => {
		const receiver = getContextHookReceiver(node);
		if (!receiver) {
			return false;
		}

		const variable = findVariable(sourceCode.getScope(receiver), receiver);
		return variable !== undefined && contextVariables.includes(variable);
	};

	const updateContext = node => {
		const importedContextCall = getImportedContextCall(node);
		const isContextHook = isContextHookCall(node);
		if (!importedContextCall && !isSubtestCall(node) && !isContextHook) {
			return;
		}

		const callback = importedContextCall?.kind === 'hook' || isContextHook
			? getHookCallback(node)
			: getTestCallback(node);
		if (!callback) {
			return;
		}

		const parameter = getContextParameterIdentifier(callback.params[0]);
		const variable = parameter
			? findVariable(sourceCode.getScope(parameter), parameter)
			: undefined;

		contextVariables.push(variable);
		pushedCalls.add(node);
	};

	const leaveContext = node => {
		if (!pushedCalls.has(node)) {
			return;
		}

		pushedCalls.delete(node);
		contextVariables.pop();
	};

	const isGlobalMock = node => {
		const expression = unwrapTypeScriptExpression(node);
		if (
			expression.type === 'Identifier'
			&& imports.mockLocals.has(expression.name)
			&& isImportedReference(expression, sourceCode)
		) {
			return true;
		}

		if (
			expression.type !== 'MemberExpression'
			|| expression.computed
			|| expression.property.type !== 'Identifier'
			|| expression.property.name !== 'mock'
		) {
			return false;
		}

		const object = unwrapTypeScriptExpression(expression.object);
		return object.type === 'Identifier'
			&& (
				object.name === imports.namespace
				|| imports.locals.get(object.name) === 'test'
				|| imports.locals.get(object.name) === 'it'
			)
			&& isImportedReference(object, sourceCode);
	};

	const isCurrentContextReference = node => {
		const variable = findVariable(sourceCode.getScope(node), node);
		return variable !== undefined && contextVariables.includes(variable);
	};

	const isGetTestContextCall = node => {
		if (node.type !== 'CallExpression') {
			return false;
		}

		const callee = unwrapTypeScriptExpression(node.callee);
		if (
			callee.type === 'Identifier'
			&& testContextLocals.has(callee.name)
			&& isImportedReference(callee, sourceCode)
		) {
			return true;
		}

		if (
			callee.type !== 'MemberExpression'
			|| callee.computed
			|| callee.property.type !== 'Identifier'
			|| callee.property.name !== 'getTestContext'
		) {
			return false;
		}

		const object = unwrapTypeScriptExpression(callee.object);
		return object.type === 'Identifier'
			&& (
				object.name === imports.namespace
				|| imports.locals.get(object.name) === 'test'
				|| imports.locals.get(object.name) === 'it'
			)
			&& isImportedReference(object, sourceCode);
	};

	const isContextMock = node => {
		const expression = unwrapTypeScriptExpression(node);
		if (
			expression.type !== 'MemberExpression'
			|| expression.computed
			|| expression.property.type !== 'Identifier'
			|| expression.property.name !== 'mock'
		) {
			return false;
		}

		const object = unwrapTypeScriptExpression(expression.object);
		return (
			(object.type === 'Identifier' && isCurrentContextReference(object))
			|| isGetTestContextCall(object)
		);
	};

	const isMockTimers = node => {
		const expression = unwrapTypeScriptExpression(node);
		return expression.type === 'MemberExpression'
			&& !expression.computed
			&& expression.property.type === 'Identifier'
			&& expression.property.name === 'timers'
			&& (isGlobalMock(expression.object) || isContextMock(expression.object));
	};

	context.on('CallExpression', node => {
		updateContext(node);
	});

	context.onExit('CallExpression', node => {
		leaveContext(node);
	});

	context.on('CallExpression', node => {
		const callee = unwrapTypeScriptExpression(node.callee);
		if (
			callee.type === 'MemberExpression'
			&& !callee.computed
			&& callee.property.type === 'Identifier'
			&& callee.property.name === 'enable'
			&& isMockTimers(callee.object)
			&& isMissingApisOption(node)
		) {
			return {
				node,
				messageId: MESSAGE_ID,
			};
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Require an explicit `apis` option when enabling `mock.timers`.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

import {
	createContextTracker,
	isGetTestContextCall,
	isGlobalMock,
	resolveImports,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'require-mock-timers-apis';
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

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

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
			tracker.isContextIdentifier(object)
			|| isGetTestContextCall(object, imports)
		);
	};

	const isMockTimers = node => {
		const expression = unwrapTypeScriptExpression(node);
		return expression.type === 'MemberExpression'
			&& !expression.computed
			&& expression.property.type === 'Identifier'
			&& expression.property.name === 'timers'
			&& (isGlobalMock(unwrapTypeScriptExpression(expression.object), imports) || isContextMock(expression.object));
	};

	context.on('CallExpression', node => {
		tracker.update(node);
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
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

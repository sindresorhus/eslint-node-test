import {resolveImports, createContextTracker, isGlobalMock} from './utils/node-test.js';
import {isFunction} from './ast/index.js';
import {unwrapTypeScriptExpression} from './utils/index.js';

const MESSAGE_ID = 'prefer-mock-accessor';
const ACCESSORS = new Set(['getter', 'setter']);
const messages = {
	[MESSAGE_ID]: 'Prefer `mock.{{accessor}}()` over `mock.method()` with `{{accessor}}: true`.',
};

function getPropertyName(property) {
	if (property.type !== 'Property' || property.computed) {
		return undefined;
	}

	if (property.key.type === 'Identifier') {
		return property.key.name;
	}

	return property.key.type === 'Literal' && typeof property.key.value === 'string' ? property.key.value : undefined;
}

function getEnabledAccessor(options) {
	const properties = new Map();

	for (let index = options.properties.length - 1; index >= 0; index -= 1) {
		const property = options.properties[index];
		if (property.type === 'SpreadElement') {
			return undefined;
		}

		// The dedicated accessor APIs spread options, unlike `mock.method()`.
		if (property.kind === 'get') {
			return undefined;
		}

		const name = getPropertyName(property);
		if (name === '__proto__') {
			return undefined;
		}

		if (ACCESSORS.has(name) && !properties.has(name)) {
			properties.set(name, property);
		}
	}

	let enabledAccessor;
	for (const accessor of ACCESSORS) {
		const property = properties.get(accessor);
		if (!property) {
			continue;
		}

		const value = unwrapTypeScriptExpression(property.value);
		if (value.type === 'Literal' && value.value === true) {
			if (enabledAccessor) {
				return undefined;
			}

			enabledAccessor = accessor;
		}
	}

	return enabledAccessor;
}

function getOptions(callExpression) {
	if (callExpression.arguments.length !== 3 && callExpression.arguments.length !== 4) {
		return undefined;
	}

	if (callExpression.arguments.length === 4 && !isFunction(unwrapTypeScriptExpression(callExpression.arguments[2]))) {
		return undefined;
	}

	const options = unwrapTypeScriptExpression(callExpression.arguments.at(-1));
	return options.type === 'ObjectExpression' ? options : undefined;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});
	const isContextMock = node => {
		node = unwrapTypeScriptExpression(node);
		return node.type === 'MemberExpression'
			&& !node.computed
			&& node.property.type === 'Identifier'
			&& node.property.name === 'mock'
			&& node.object.type === 'Identifier'
			&& tracker.isContextIdentifier(node.object);
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
			callee.type !== 'MemberExpression'
			|| callee.computed
			|| callee.property.type !== 'Identifier'
			|| callee.property.name !== 'method'
			|| (!isGlobalMock(unwrapTypeScriptExpression(callee.object), imports) && !isContextMock(callee.object))
		) {
			return;
		}

		const options = getOptions(node);
		if (!options) {
			return;
		}

		const accessor = getEnabledAccessor(options);
		if (!accessor) {
			return;
		}

		return {
			node: callee.property,
			messageId: MESSAGE_ID,
			data: {accessor},
			fix: fixer => fixer.replaceText(callee.property, accessor),
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer `mock.getter()` and `mock.setter()` over `mock.method()` with accessor options.',
			recommended: true,
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

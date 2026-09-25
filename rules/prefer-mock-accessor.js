import {
	resolveImports,
	createContextTracker,
	isGetTestContextCall,
	isGlobalMock,
} from './utils/node-test.js';
import {isFunction} from './ast/index.js';
import {unwrapTypeScriptExpression, unwrapExpression, getStaticPropertyName} from './utils/index.js';

const MESSAGE_ID = 'prefer-mock-accessor';
const ACCESSORS = new Set(['getter', 'setter']);
const messages = {
	[MESSAGE_ID]: 'Prefer `mock.{{accessor}}()` over `mock.method()` with `{{accessor}}: true`.',
};

function getEnabledAccessor(options) {
	const properties = new Map();

	for (let index = options.properties.length - 1; index >= 0; index -= 1) {
		const property = options.properties[index];
		// A spread, or a computed key that does not fold to a constant, can name an accessor this scan
		// never saw, or override one it did, so the effective options stay unreadable. A key that does
		// fold names the same property a bare one does, which real `mock.method()` also reads, so
		// `{['getter']: true}` is the `{getter: true}` this rule reports.
		if (
			property.type === 'SpreadElement'
			|| (property.computed && getStaticPropertyName(property) === undefined)
		) {
			return undefined;
		}

		// The dedicated accessor APIs spread options, unlike `mock.method()`.
		if (property.kind === 'get') {
			return undefined;
		}

		const name = getStaticPropertyName(property);
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
	if (callExpression.arguments.some(argument => argument.type === 'SpreadElement')) {
		return undefined;
	}

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
		node = unwrapExpression(node);
		if (
			node.type !== 'MemberExpression'
			|| node.computed
			|| node.property.type !== 'Identifier'
			|| node.property.name !== 'mock'
		) {
			return false;
		}

		// The receiver is either a context parameter or a `getTestContext()` call, which is the same
		// context.
		const object = unwrapExpression(node.object);
		return (object.type === 'Identifier' && tracker.isContextIdentifier(object))
			|| isGetTestContextCall(object, imports);
	};

	context.on('CallExpression', node => {
		tracker.update(node);
	});
	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});

	context.on('CallExpression', node => {
		const callee = unwrapExpression(node.callee);
		if (
			callee.type !== 'MemberExpression'
			|| callee.computed
			|| callee.property.type !== 'Identifier'
			|| callee.property.name !== 'method'
			|| (!isGlobalMock(unwrapExpression(callee.object), imports) && !isContextMock(callee.object))
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

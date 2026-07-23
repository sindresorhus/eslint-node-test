import {resolveImports} from './utils/node-test.js';

const MESSAGE_ID = 'no-mock-timers-destructured-import';

const messages = {
	[MESSAGE_ID]: '`{{name}}` is imported directly, so `mock.timers` cannot intercept it. Call the global `{{name}}` instead.',
};

const TIMER_MODULES = new Set(['node:timers', 'timers']);

// Imported timer function -> the `mock.timers` API name that mocks it.
const FUNCTION_TO_API = new Map([
	['setTimeout', 'setTimeout'],
	['clearTimeout', 'setTimeout'],
	['setInterval', 'setInterval'],
	['clearInterval', 'setInterval'],
	['setImmediate', 'setImmediate'],
	['clearImmediate', 'setImmediate'],
]);

/*
The enabled timer APIs, or `null` when `enable()` was called without an `apis` list (all APIs).
*/
function getEnabledApis(callExpression) {
	const [argument] = callExpression.arguments;
	if (argument?.type !== 'ObjectExpression') {
		return null;
	}

	const apisProperty = argument.properties.find(property =>
		property.type === 'Property'
		&& !property.computed
		&& (
			(property.key.type === 'Identifier' && property.key.name === 'apis')
			|| (property.key.type === 'Literal' && property.key.value === 'apis')
		));

	if (apisProperty?.value.type !== 'ArrayExpression') {
		return null;
	}

	return apisProperty.value.elements
		.filter(element => element?.type === 'Literal' && typeof element.value === 'string')
		.map(element => element.value);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Named timer-function imports from `node:timers`.
	const timerImports = [];
	for (const node of sourceCode.ast.body) {
		// Type-only imports (`import type {setTimeout} …`) are erased and create no runtime binding,
		// so the code still calls the interceptable global.
		if (node.type !== 'ImportDeclaration' || node.importKind === 'type' || !TIMER_MODULES.has(node.source.value)) {
			continue;
		}

		for (const specifier of node.specifiers) {
			if (
				specifier.type === 'ImportSpecifier'
				&& specifier.importKind !== 'type'
				&& specifier.imported.type === 'Identifier'
				&& FUNCTION_TO_API.has(specifier.imported.name)
			) {
				timerImports.push(specifier);
			}
		}
	}

	if (timerImports.length === 0) {
		return;
	}

	const {mockLocals} = imports;

	// `mock.timers` (global) or `t.mock.timers` (context).
	const isMockTimers = node =>
		node.type === 'MemberExpression'
		&& !node.computed
		&& node.property.type === 'Identifier'
		&& node.property.name === 'timers'
		&& (
			// `mock.timers` (global, named/renamed import).
			(node.object.type === 'Identifier' && mockLocals.has(node.object.name))
			// `t.mock.timers` (context) or `namespace.mock.timers`.
			|| (
				node.object.type === 'MemberExpression'
				&& !node.object.computed
				&& node.object.property.type === 'Identifier'
				&& node.object.property.name === 'mock'
			)
		);

	const enabledApis = new Set();
	let isAllEnabled = false;

	context.on('CallExpression', node => {
		const {callee} = node;
		if (
			callee.type === 'MemberExpression'
			&& !callee.computed
			&& callee.property.type === 'Identifier'
			&& callee.property.name === 'enable'
			&& isMockTimers(callee.object)
		) {
			const apis = getEnabledApis(node);
			if (apis === null) {
				isAllEnabled = true;
			} else {
				for (const api of apis) {
					enabledApis.add(api);
				}
			}
		}
	});

	context.onExit('Program', () => {
		if (!isAllEnabled && enabledApis.size === 0) {
			return;
		}

		return timerImports
			.filter(specifier => isAllEnabled || enabledApis.has(FUNCTION_TO_API.get(specifier.imported.name)))
			.map(specifier => ({
				node: specifier,
				messageId: MESSAGE_ID,
				data: {name: specifier.imported.name},
			}));
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow destructured timer imports when using `mock.timers`.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

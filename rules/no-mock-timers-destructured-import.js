import {
	resolveImports,
	findOptionsProperty,
	createContextTracker,
	isGetTestContextCall,
	isGlobalMock,
} from './utils/node-test.js';

const MESSAGE_ID = 'no-mock-timers-destructured-import';
const MESSAGE_ID_NAMESPACE = 'no-mock-timers-destructured-import/namespace';

const messages = {
	[MESSAGE_ID]: '`{{name}}` is imported directly, so `mock.timers` cannot intercept it. Call the global `{{name}}` instead.',
	[MESSAGE_ID_NAMESPACE]: '`{{name}}` is imported as a namespace, so it holds the real timer functions and `mock.timers` cannot intercept them. Call the global timer functions instead.',
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
What an `enable()` call enables:

- `all`: no `apis` list at all, so every timer API is mocked
- `list`: a statically known `apis` array
- `unknown`: an `apis` value that cannot be resolved at lint time, so nothing can be proven

`findOptionsProperty` reads the last one the runner sees and gives up when a later spread could
override it, which is the same contract every other option-reading rule uses.
*/
function getEnabledApis(callExpression) {
	const [argument] = callExpression.arguments;
	if (argument?.type !== 'ObjectExpression') {
		return {all: true};
	}

	const apisProperty = findOptionsProperty(argument, 'apis');
	if (!apisProperty) {
		// A spread or computed key can hide or replace `apis`, in which case the list is not
		// statically known. Without one, the runner mocks every timer API.
		return argument.properties.some(property => property.type === 'SpreadElement' || property.computed)
			? {unknown: true}
			: {all: true};
	}

	if (apisProperty.value.type !== 'ArrayExpression') {
		return {unknown: true};
	}

	const apis = [];
	for (const element of apisProperty.value.elements) {
		if (element?.type !== 'Literal' || typeof element.value !== 'string') {
			// A spread or computed entry makes the list only partly known, which proves nothing.
			return {unknown: true};
		}

		apis.push(element.value);
	}

	return {list: apis};
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
	// `import * as timers from 'node:timers'` is captured too: the namespace object is a snapshot of
	// the module taken at import time, before `mock.timers.enable()` patches `module.exports`, so
	// `timers.setTimeout(…)` escapes the mock exactly like a destructured import.
	const namespaceImports = [];
	for (const node of sourceCode.ast.body) {
		// Type-only imports (`import type {setTimeout} …`) are erased and create no runtime binding,
		// so the code still calls the interceptable global.
		if (node.type !== 'ImportDeclaration' || node.importKind === 'type' || !TIMER_MODULES.has(node.source.value)) {
			continue;
		}

		for (const specifier of node.specifiers) {
			if (specifier.type === 'ImportNamespaceSpecifier') {
				namespaceImports.push(specifier);
			} else if (
				specifier.type === 'ImportSpecifier'
				&& specifier.importKind !== 'type'
				&& specifier.imported.type === 'Identifier'
				&& FUNCTION_TO_API.has(specifier.imported.name)
			) {
				timerImports.push(specifier);
			}
		}
	}

	if (timerImports.length === 0 && namespaceImports.length === 0) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	// `t.mock.timers` (a test context) or `getTestContext().mock.timers`. An unrelated
	// `<anything>.mock.timers` is another object's API and has nothing to do with the global tracker.
	const isContextMock = node =>
		node.type === 'MemberExpression'
		&& !node.computed
		&& node.property.type === 'Identifier'
		&& node.property.name === 'mock'
		&& (
			tracker.isContextIdentifier(node.object)
			|| isGetTestContextCall(node.object, imports)
		);

	const isMockTimers = node =>
		node.type === 'MemberExpression'
		&& !node.computed
		&& node.property.type === 'Identifier'
		&& node.property.name === 'timers'
		// `mock.timers` (global import) or `t.mock.timers` (context).
		&& (isGlobalMock(node.object, imports) || isContextMock(node.object));

	const enabledApis = new Set();
	let isAllEnabled = false;

	context.on('CallExpression', node => {
		tracker.update(node);

		const {callee} = node;
		if (
			callee.type === 'MemberExpression'
			&& !callee.computed
			&& callee.property.type === 'Identifier'
			&& callee.property.name === 'enable'
			&& isMockTimers(callee.object)
		) {
			const apis = getEnabledApis(node);
			if (apis.all) {
				isAllEnabled = true;
			} else if (apis.list) {
				for (const api of apis.list) {
					enabledApis.add(api);
				}
			}
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});

	context.onExit('Program', () => {
		if (!isAllEnabled && enabledApis.size === 0) {
			return;
		}

		const problems = timerImports
			.filter(specifier => isAllEnabled || enabledApis.has(FUNCTION_TO_API.get(specifier.imported.name)))
			.map(specifier => ({
				node: specifier,
				messageId: MESSAGE_ID,
				data: {name: specifier.imported.name},
			}));

		// A namespace import holds the real timer functions for every API, so any enabled timer API
		// makes it a problem.
		if (namespaceImports.length > 0 && (isAllEnabled || enabledApis.size > 0)) {
			for (const specifier of namespaceImports) {
				problems.push({
					node: specifier,
					messageId: MESSAGE_ID_NAMESPACE,
					data: {name: specifier.local.name},
				});
			}
		}

		return problems;
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

import {
	resolveImports,
	findOptionsProperty,
	createContextTracker,
	isMockTimers,
	getImportSpecifierName,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {isMemberExpression, isUndefinedValue} from './ast/index.js';
import {getStaticPropertyName} from './utils/index.js';

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

/** The APIs that mock a timer function, which is every enabled API but `Date`. */
const TIMER_APIS = new Set(FUNCTION_TO_API.values());

/** Whether a node is `undefined`, `void …` or `null`, which the runner reads the same as a value that is left out. */
function isNoValue(node) {
	return isUndefinedValue(node)
		|| (node.type === 'Literal' && node.value === null);
}

/*
What an `enable()` call enables:

- `all`: no `apis` list at all, so every timer API is mocked
- `list`: a statically known `apis` array
- `unknown`: an options argument or an `apis` value that cannot be resolved at lint time, so nothing can be proven

`findOptionsProperty` reads the last one the runner sees and gives up when a later spread could
override it, which is the same contract every other option-reading rule uses.
*/
function getEnabledApis(callExpression) {
	// A TypeScript wrapper (`{apis: ['Date']} as const`) is erased at runtime, so it must not hide the options.
	const argument = unwrapTypeScriptExpression(callExpression.arguments[0]);
	// `undefined`, `void 0` and `null` are ways to write "no options given", like leaving the argument out, and the runner then mocks every timer API.
	if (!argument || isNoValue(argument)) {
		return {all: true};
	}

	// An identifier, a call or a spread holds options that cannot be read at lint time.
	if (argument.type !== 'ObjectExpression') {
		return {unknown: true};
	}

	const apisProperty = findOptionsProperty(argument, 'apis');
	if (!apisProperty) {
		// A spread or computed key can hide or replace `apis`, in which case the list is not statically known. Without one, the runner mocks every timer API. A computed key that folds to a constant names a known property, the way `findOptionsProperty` reads it.
		return argument.properties.some(property => property.type === 'SpreadElement' || getStaticPropertyName(property) === undefined)
			? {unknown: true}
			: {all: true};
	}

	// `undefined`, `void 0` and `null` are three ways to write "no `apis` given", and the runner takes that as every timer API rather than rejecting it. A TypeScript wrapper on the list or an entry (`['setTimeout'] as const`) is erased at runtime too.
	const value = unwrapTypeScriptExpression(apisProperty.value);
	if (isNoValue(value)) {
		return {all: true};
	}

	if (value.type !== 'ArrayExpression') {
		return {unknown: true};
	}

	const apis = [];
	for (const rawElement of value.elements) {
		const element = rawElement && unwrapTypeScriptExpression(rawElement);
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
	// `import * as timers from 'node:timers'` is captured too: the namespace object is a snapshot of the module taken at import time, before `mock.timers.enable()` patches `module.exports`, so `timers.setTimeout(…)` escapes the mock exactly like a destructured import.
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
				&& FUNCTION_TO_API.has(getImportSpecifierName(specifier))
			) {
				timerImports.push(specifier);
			}
		}
	}

	if (timerImports.length === 0 && namespaceImports.length === 0) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	const enabledApis = new Set();
	let isAllEnabled = false;

	context.on('CallExpression', node => {
		tracker.update(node);

		// A TypeScript wrapper on the callee (`enable!(…)`, `(enable as any)(…)`) must not hide the call.
		const callee = unwrapTypeScriptExpression(node.callee);
		if (
			isMemberExpression(callee, 'enable')
			&& isMockTimers(callee.object, imports, tracker)
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
			.filter(specifier => isAllEnabled || enabledApis.has(FUNCTION_TO_API.get(getImportSpecifierName(specifier))))
			.map(specifier => ({
				node: specifier,
				messageId: MESSAGE_ID,
				data: {name: getImportSpecifierName(specifier)},
			}));

		// A namespace import holds the real timer functions for every API, so any enabled timer API makes it a problem. A list of only `Date` mocks no timer function, so the namespace import is then harmless, exactly as it is for a named import.
		const hasEnabledTimerApi = [...enabledApis].some(api => TIMER_APIS.has(api));
		if (namespaceImports.length > 0 && (isAllEnabled || hasEnabledTimerApi)) {
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

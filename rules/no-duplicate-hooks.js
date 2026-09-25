import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	isOutOfLineCallback,
	getHookCallback,
	createContextTracker,
	isContextHookCall,
	getContextHookName,
} from './utils/node-test.js';
import {functionTypes} from './ast/index.js';

const MESSAGE_ID = 'no-duplicate-hooks';

const messages = {
	[MESSAGE_ID]: 'Duplicate `{{name}}` hook in the same scope.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Stack of scopes; each scope tracks the hook names already declared in it.
	const scopeStack = [new Set()];
	// Calls whose callback opened a scope, so we can pop on exit.
	const pushedCalls = new Set();

	// Subtests (`t.test(…)`) are their own scope, and a hook declared on a context
	// (`t.beforeEach(…)`) is a real hook; neither is an imported binding, so the tracker is needed.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		if (!parsed && !isSubtest && !isContextHook) {
			return;
		}

		let problem;
		if (isContextHook) {
			const name = getContextHookName(node);
			const scope = scopeStack.at(-1);
			if (scope.has(name)) {
				problem = {node, messageId: MESSAGE_ID, data: {name}};
			} else {
				scope.add(name);
			}
		} else if (parsed?.kind === 'hook') {
			const scope = scopeStack.at(-1);
			if (scope.has(parsed.name)) {
				problem = {
					node,
					messageId: MESSAGE_ID,
					data: {name: parsed.name},
				};
			} else {
				scope.add(parsed.name);
			}
		}

		// A hook body is a scope of its own, like a test or a suite body. Its `t` is the context of the
		// test the hook runs for, so a hook declared on it is registered on that test and fires there (a
		// `beforeEach` for that test's subtests), which is not the scope the hook itself was declared in.
		// It is not a duplicate of a hook outside it.
		const callback = isContextHook || parsed?.kind === 'hook'
			? getHookCallback(node)
			: (isSubtest || parsed?.kind === 'test' || parsed?.kind === 'suite' ? getTestCallback(node) : undefined);
		if (callback) {
			scopeStack.push(new Set());
			pushedCalls.add(node);
		}

		return problem;
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);

		if (!pushedCalls.has(node)) {
			return;
		}

		pushedCalls.delete(node);
		scopeStack.pop();
	});

	// A callback the call names out of line (`describe('s', body)`) is entered where it is declared,
	// which the call's own scope does not cover, so its hooks are scoped to that suite as well.
	const outOfLineCallbacks = new WeakSet();

	context.on(functionTypes, node => {
		if (!isOutOfLineCallback(node, context, imports)) {
			return;
		}

		outOfLineCallbacks.add(node);
		scopeStack.push(new Set());
	});

	context.onExit(functionTypes, node => {
		if (outOfLineCallbacks.delete(node)) {
			scopeStack.pop();
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow duplicate hooks within the same scope.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

import {
	resolveImports,
	parseTestCall,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	getTestCallback,
	createContextTracker,
	isContextHookCall,
	getContextHookName,
} from './utils/node-test.js';
import {getEnclosingFunction, isArrayIterationCallback} from './utils/index.js';
import {functionTypes} from './ast/index.js';

const MESSAGE_ID = 'prefer-hooks-on-top';

const messages = {
	[MESSAGE_ID]: 'Hook `{{name}}` should come before any test or `describe` in its scope.',
};

/*
Whether a test belongs to the scope that `scopeFunction` opened. An array-iteration callback (`cases.forEach(c => { it(…); })`) runs where it is written, so a test in it is a test of the enclosing scope, the same as one in a `for…of` body.
*/
function isTestInScope(node, scopeFunction) {
	let function_ = getEnclosingFunction(node);
	while (function_ !== scopeFunction && function_ && isArrayIterationCallback(function_)) {
		function_ = getEnclosingFunction(function_);
	}

	return function_ === scopeFunction;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Stack of scopes; each tracks the function it belongs to and whether a test/suite has appeared in it yet. The function keeps a hook inside an unrelated nested function from counting against a test that is not in its scope at all.
	const scopeStack = [{seenTest: false, function: undefined}];
	const pushedCalls = new Set();

	// A subtest (`t.test(…)`) is a test, and a hook declared on a context (`t.beforeEach(…)`) is a hook; both are method calls, so the tracker recognizes them alongside the imported forms.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		if (!parsed && !isSubtest && !isContextHook) {
			return;
		}

		const scope = scopeStack.at(-1);
		const isInScope = scope.function === getEnclosingFunction(node);

		let problem;
		if (isContextHook) {
			if (isInScope && scope.seenTest) {
				problem = {node, messageId: MESSAGE_ID, data: {name: getContextHookName(node)}};
			}
		} else if (parsed?.kind === 'hook' && isInScope && scope.seenTest) {
			problem = {
				node,
				messageId: MESSAGE_ID,
				data: {name: parsed.name},
			};
		}

		if (isSubtest || parsed?.kind === 'test' || parsed?.kind === 'suite') {
			// A test inside another function shares no scope with a hook in this one, exactly as a hook inside another function does not count against a test here. An array-iteration callback is the exception, see `isTestInScope`.
			if (isTestInScope(node, scope.function)) {
				scope.seenTest = true;
			}

			const callback = getTestCallback(node);
			if (callback) {
				scopeStack.push({seenTest: false, function: callback});
				pushedCalls.add(node);
			}
		}

		return problem;
	});

	// A callback the call names out of line (`describe('s', body)`) is entered where it is declared, which the call's own scope does not cover, so a hook after a test in it is still out of order. Only a test or suite body opens a scope, exactly as its inline spelling does: a hook body does not.
	const outOfLineCallbacks = new WeakSet();

	context.on(functionTypes, node => {
		const kind = getRegistrationKind(getOutOfLineCallbackCall(node, context, imports), imports, context);
		if (kind !== 'test' && kind !== 'suite') {
			return;
		}

		outOfLineCallbacks.add(node);
		scopeStack.push({seenTest: false, function: node});
	});

	context.onExit(functionTypes, node => {
		if (outOfLineCallbacks.delete(node)) {
			scopeStack.pop();
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);

		if (!pushedCalls.has(node)) {
			return;
		}

		pushedCalls.delete(node);
		scopeStack.pop();
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Require hooks to be declared before the tests in their scope.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

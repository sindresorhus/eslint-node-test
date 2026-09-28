import {
	resolveImports,
	parseTestCall,
	getHookCallback,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	createContextTracker,
	isContextHookCall,
} from './utils/node-test.js';
import {functionTypes} from './ast/index.js';

const MESSAGE_ID = 'no-test-inside-hook';

const messages = {
	[MESSAGE_ID]: 'Do not define a test or suite inside a hook. Define it at the top level or inside a `describe`.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Stack of hook callback function nodes we are currently inside. A test registered in a hook
	// callback is dropped at runtime, whether the hook is imported (`beforeEach(…)`) or declared on a
	// test context (`t.beforeEach(…)`).
	const hookCallbackStack = [];

	// The tracker is needed to recognise a context hook: `t.beforeEach(…)` is a method call on the
	// test's context parameter, not an imported binding.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		// Query the tracker before it learns about this call, so the receiver is the enclosing context.
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		// A subtest (`t.test(…)`) is a test registered through a context, which a hook drops the same
		// way it drops an imported `test(…)` call.
		const isSubtest = tracker.isSubtestCall(node);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		if (!parsed && !isContextHook && !isSubtest) {
			return;
		}

		const kind = isContextHook ? 'hook' : (parsed ? parsed.kind : 'test');

		if ((kind === 'test' || kind === 'suite') && hookCallbackStack.length > 0) {
			return {
				node,
				messageId: MESSAGE_ID,
			};
		}

		if (kind === 'hook') {
			const callback = getHookCallback(node);
			if (callback) {
				hookCallbackStack.push(callback);
			}
		}
	});

	context.onExit('CallExpression', node => {
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		tracker.leave(node);

		const parsed = parseTestCall(node, imports);
		if (parsed?.kind !== 'hook' && !isContextHook) {
			return;
		}

		const callback = getHookCallback(node);
		if (callback && hookCallbackStack.at(-1) === callback) {
			hookCallbackStack.pop();
		}
	});

	// A hook callback the call names out of line is entered where it is declared, which the call's own
	// frame does not cover, so a test inside it is still inside the hook and the runner still drops it.
	const outOfLineHookCallbacks = new WeakSet();

	context.on(functionTypes, node => {
		const call = getOutOfLineCallbackCall(node, context, imports, tracker.isContextReceiver);
		if (getRegistrationKind(call, imports, tracker.isContextReceiver, context) !== 'hook') {
			return;
		}

		outOfLineHookCallbacks.add(node);
		hookCallbackStack.push(node);
	});

	context.onExit(functionTypes, node => {
		if (outOfLineHookCallbacks.delete(node)) {
			hookCallbackStack.pop();
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow defining tests and suites inside a hook.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

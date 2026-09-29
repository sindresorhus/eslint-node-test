import {
	resolveImports,
	parseTestCall,
	getHookCallback,
	getTestCallback,
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
	// test context (`t.beforeEach(…)`). A test body inside a hook is on the stack too, as `undefined`:
	// a test defined in that body is nested in the test, not in the hook, which is `no-nested-tests`'s
	// to report, and is how the same body reads when it is named out of line.
	const hookCallbackStack = [];
	// The calls whose callbacks are on the stack, so the exit pops exactly what the entry pushed.
	const pushedCalls = new WeakSet();

	// The tracker is needed to recognise a context hook: `t.beforeEach(…)` is a method call on the
	// test's context parameter, not an imported binding.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		// Query the tracker before it learns about this call, so the receiver is the enclosing context.
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		// A subtest (`t.test(…)`) is a test registered through a context. From a `beforeEach` or `afterEach` it does run, as a subtest of each test the hook runs for, but it is reported all the same: the subtest belongs in the test body.
		const isSubtest = tracker.isSubtestCall(node);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		if (!parsed && !isContextHook && !isSubtest) {
			return;
		}

		const kind = isContextHook ? 'hook' : (parsed ? parsed.kind : 'test');

		const isInHook = hookCallbackStack.at(-1) !== undefined;

		if (kind === 'hook') {
			const callback = getHookCallback(node);
			if (callback) {
				hookCallbackStack.push(callback);
				pushedCalls.add(node);
			}
		} else if (kind === 'test' && isInHook) {
			const callback = getTestCallback(node, imports);
			if (callback) {
				hookCallbackStack.push(undefined);
				pushedCalls.add(node);
			}
		}

		if ((kind === 'test' || kind === 'suite') && isInHook) {
			return {
				node,
				messageId: MESSAGE_ID,
			};
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);

		if (pushedCalls.delete(node)) {
			hookCallbackStack.pop();
		}
	});

	// A hook callback the call names out of line is entered where it is declared, which the call's own
	// frame does not cover, so a test inside it is still inside the hook and the runner still drops it.
	// A test body named out of line opens its frame the same way.
	const outOfLineCallbacks = new WeakSet();

	context.on(functionTypes, node => {
		const call = getOutOfLineCallbackCall(node, context, imports);
		const kind = getRegistrationKind(call, imports, context);
		if (kind !== 'hook' && kind !== 'test') {
			return;
		}

		outOfLineCallbacks.add(node);
		hookCallbackStack.push(kind === 'hook' ? node : undefined);
	});

	context.onExit(functionTypes, node => {
		if (outOfLineCallbacks.delete(node)) {
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

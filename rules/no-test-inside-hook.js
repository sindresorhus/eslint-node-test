import {
	resolveImports,
	parseTestCall,
	getHookCallback,
	createContextTracker,
	isContextHookCall,
} from './utils/node-test.js';

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
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		if (!parsed && !isContextHook) {
			return;
		}

		const kind = isContextHook ? 'hook' : parsed.kind;

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

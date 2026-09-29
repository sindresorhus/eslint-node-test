import {
	resolveImports,
	parseTestCall,
	resolveCallbackArgument,
	getResolvedTestCallback,
	getEffectiveArity,
	getRuntimeParameter,
	createContextTracker,
	isContextHookCall,
} from './utils/node-test.js';

const MESSAGE_ID = 'no-done-callback';

const messages = {
	[MESSAGE_ID]: 'Use `async`/`await` or return a Promise instead of the `{{name}}` callback parameter.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Subtests (`t.test(…)`) and context hooks (`t.beforeEach(…)`) are method calls, not imported bindings, but their callbacks receive the same `done` based on arity.
	const tracker = createContextTracker(imports, {trackHooks: true});

	// A body named out of line can be passed to several calls, but it is one function, so it is reported once.
	const reportedCallbacks = new Set();

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		// Suite (`describe`/`suite`) callbacks receive a `SuiteContext`, never a `done` callback.
		if (parsed?.kind !== 'test' && parsed?.kind !== 'hook' && !isSubtest && !isContextHook) {
			return;
		}

		// A context hook (`t.beforeEach(…)`) takes only a callback, so a function in any later slot is dead code there too. A callback the call names out of line is still the callback the runner calls, so it is read as the function its binding reaches.
		const callback = isContextHook ? resolveCallbackArgument(node.arguments[0], context) : getResolvedTestCallback(node, context, imports);
		// A declared second parameter is the `done` callback `node:test` passes based on arity.
		if (
			!callback
			|| reportedCallbacks.has(callback)
			|| getEffectiveArity(callback.params) < 2
		) {
			return;
		}

		reportedCallbacks.add(callback);

		// A TypeScript `this` parameter is erased before the code runs, so the reported slot is the second emitted parameter, which is what `getEffectiveArity` counted.
		const parameter = getRuntimeParameter(callback.params, 1);
		return {
			node: parameter,
			messageId: MESSAGE_ID,
			data: {name: parameter.type === 'Identifier' ? parameter.name : 'done'},
		};
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow callback (`done`) parameters in tests and hooks.',
			recommended: false,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

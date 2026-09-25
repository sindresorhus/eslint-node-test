import {
	resolveImports,
	parseTestCall,
	getHookCallback,
	getTestCallback,
	getEffectiveArity,
	createContextTracker,
	isContextHookCall,
} from './utils/node-test.js';

const MESSAGE_ID = 'no-callback-and-promise';

const messages = {
	[MESSAGE_ID]: 'A {{kind}} cannot use both a callback parameter and a Promise; this `async` function also declares a callback.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Subtests (`t.test(…)`) and context hooks (`t.beforeEach(…)`) are method calls, not imported
	// bindings, but their async callback with a `done` parameter fails the same way.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		// Suite (`describe`/`suite`) callbacks receive a `SuiteContext`, never a `done` callback.
		if (parsed?.kind !== 'test' && parsed?.kind !== 'hook' && !isSubtest && !isContextHook) {
			return;
		}

		// A context hook (`t.beforeEach(…)`) takes only a callback, so a function in a later slot is
		// dead code there too.
		const callback = isContextHook ? getHookCallback(node) : getTestCallback(node, imports);
		if (!callback?.async || getEffectiveArity(callback.params) < 2) {
			return;
		}

		return {
			node: callback.params[1],
			messageId: MESSAGE_ID,
			data: {kind: parsed?.kind === 'hook' || isContextHook ? 'hook' : 'test'},
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
		type: 'problem',
		docs: {
			description: 'Disallow a test or hook from using both a callback and a Promise.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

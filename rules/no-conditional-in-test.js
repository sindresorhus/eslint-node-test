import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	createContextTracker,
	isContextHookCall,
} from './utils/node-test.js';
import isFunction from './ast/is-function.js';

const MESSAGE_ID = 'no-conditional-in-test';

const messages = {
	[MESSAGE_ID]: 'Avoid conditional logic in a test; a test should run the same way every time.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Callbacks of test/hook calls. Conditionals inside a `describe` body are about test
	// registration (see `no-conditional-tests`), so suites are excluded here.
	const testCallbacks = new Set();
	// Subtests are method calls rather than imported bindings, so the tracker recognizes them.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		const isSubtest = tracker.isSubtestCall(node);
		// A hook declared on a test context (`t.beforeEach(…)`) is a hook callback too, even though it
		// is a method call rather than an imported binding.
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		if (!isSubtest && !isContextHook && parsed?.kind !== 'test' && parsed?.kind !== 'hook') {
			return;
		}

		const callback = getTestCallback(node);
		if (callback) {
			testCallbacks.add(callback);
		}

		tracker.update(node);
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});

	const report = node => {
		// The conditional must sit inside the test callback itself, not in a sibling argument like the
		// options object (`{skip: a ? … : …}`) or inside a nested helper function. A call between the
		// two means the conditional is an argument of that call, which the test body only evaluates.
		for (let current = node; current; current = current.parent) {
			if (isFunction(current)) {
				return testCallbacks.has(current) ? {node, messageId: MESSAGE_ID} : undefined;
			}

			if (current.type === 'CallExpression') {
				return undefined;
			}
		}
	};

	context.on('IfStatement', report);
	context.on('SwitchStatement', report);
	context.on('ConditionalExpression', report);
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow conditional logic inside tests.',
			recommended: false,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

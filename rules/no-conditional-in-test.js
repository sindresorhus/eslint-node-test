import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	createContextTracker,
} from './utils/node-test.js';
import {getEnclosingFunction} from './utils/index.js';

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
		if (!isSubtest && parsed?.kind !== 'test' && parsed?.kind !== 'hook') {
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
		// The conditional must sit directly in the test body, not in a sibling argument like the
		// options object (`{skip: a ? … : …}`) or inside a nested helper function.
		const enclosing = getEnclosingFunction(node);
		if (enclosing && testCallbacks.has(enclosing)) {
			return {node, messageId: MESSAGE_ID};
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

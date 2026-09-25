import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getOutOfLineCallbackCall,
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

	// A call that registers a test, subtest, or hook: a conditional in its own arguments (the title,
	// the options) is registration-time configuration, not logic the test body runs. The tracker
	// resolves the receiver, so an unrelated object's `test` method is not a registration.
	const isRegistrationCall = node => parseTestCall(node, imports) !== undefined
		|| tracker.isSubtestCall(node)
		|| isContextHookCall(node, tracker.isContextReceiver);

	const report = node => {
		// The conditional must sit inside the test callback itself, not in a sibling argument of a
		// registration call like the options object (`{skip: a ? … : …}`), which is evaluated while the
		// file loads, nor inside a nested helper function. A conditional in an argument of any other
		// call is the test body's own logic, so the walk continues past it.
		for (let current = node; current; current = current.parent) {
			if (isFunction(current)) {
				return testCallbacks.has(current) ? {node, messageId: MESSAGE_ID} : undefined;
			}

			if (current.type === 'CallExpression' && isRegistrationCall(current)) {
				return undefined;
			}
		}
	};

	// A callback the call names out of line is entered where it is declared, which the call's own frame
	// does not cover, so a conditional in it is still inside the test body. A suite body is about test
	// registration, so it stays excluded the way the inline form is.
	const functionTypes = ['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration'];
	const outOfLineTestCallbacks = new WeakSet();

	context.on(functionTypes, node => {
		const call = getOutOfLineCallbackCall(node, context, imports);
		const kind = call && parseTestCall(call, imports)?.kind;
		if (kind !== 'test' && kind !== 'hook') {
			return;
		}

		outOfLineTestCallbacks.add(node);
		testCallbacks.add(node);
	});

	context.onExit(functionTypes, node => {
		if (outOfLineTestCallbacks.delete(node)) {
			testCallbacks.delete(node);
		}
	});

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

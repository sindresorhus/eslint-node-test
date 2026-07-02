import {resolveImports, parseTestCall, getTestCallback} from './utils/node-test.js';
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

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (parsed?.kind !== 'test' && parsed?.kind !== 'hook') {
			return;
		}

		const callback = getTestCallback(node);
		if (callback) {
			testCallbacks.add(callback);
		}
	});

	const report = node => {
		// The conditional must sit directly in the test body, not in a sibling argument like the
		// options object (`{skip: a ? … : …}`) or inside a nested helper function.
		let enclosing = node.parent;
		while (enclosing && !isFunction(enclosing)) {
			enclosing = enclosing.parent;
		}

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

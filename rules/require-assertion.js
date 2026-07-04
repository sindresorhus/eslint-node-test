import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	parseAssertionCall,
	createContextTracker,
	isAssertionCallWithSupportedContext,
} from './utils/node-test.js';

const MESSAGE_ID = 'require-assertion/error';

const messages = {
	[MESSAGE_ID]: 'Test is missing an assertion. Tests without assertions will always pass.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	/*
	Stack of {callNode, callback, hasAssertion} for each open test call.
	We push when we enter a test call with an inline callback, and pop (and possibly report) on exit.
	*/
	const testStack = [];
	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		tracker.update(node);

		const parsed = parseTestCall(node, imports);

		// Track nested test calls as their own scope (don't let their assertions count for parent).
		if (parsed && parsed.kind === 'test') {
			const callback = getTestCallback(node);
			// Only push if there's an inline function body to inspect.
			if (callback) {
				testStack.push({callNode: node, callback, hasAssertion: false});
				return;
			}

			// No inline callback: skip/todo or external implementation — don't report.
			if (testStack.length > 0) {
				// Mark parent as having an assertion-like (external impl may assert).
				testStack.at(-1).hasAssertion = true;
			}

			return;
		}

		// Check if this call is an assertion.
		if (testStack.length > 0 && parseAssertionCall(node, imports) && isAssertionCallWithSupportedContext(node, tracker)) {
			testStack.at(-1).hasAssertion = true;
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);

		if (testStack.length === 0) {
			return;
		}

		const top = testStack.at(-1);
		if (top.callNode !== node) {
			return;
		}

		testStack.pop();

		if (!top.hasAssertion) {
			return {
				node,
				messageId: MESSAGE_ID,
			};
		}

		// Propagate to parent: a nested test call itself doesn't count as an assertion in the parent.
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Require that each test contains at least one assertion.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

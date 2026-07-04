import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getSubtestReceiver,
	parseAssertionCall,
	createContextTracker,
	isAssertionCallWithSupportedContext,
} from './utils/node-test.js';
import isConditionalBranch from './utils/is-conditional-branch.js';

const MESSAGE_ID = 'no-conditional-assertion/error';

const messages = {
	[MESSAGE_ID]: 'Assertions should not be placed inside conditionals, as they may never execute.',
};

/*
The callback that bounds an assertion's scope: a test/hook call, or a subtest (`t.test(…)`, a method
call rather than an imported binding). Returns `undefined` for suites (their bodies only register
tests, so conditional assertions there are not this rule's concern) and non-test calls.
*/
function getScopeBoundaryCallback(node, imports) {
	const parsed = parseTestCall(node, imports);
	if (parsed) {
		return parsed.kind === 'test' || parsed.kind === 'hook' ? getTestCallback(node) : undefined;
	}

	return getSubtestReceiver(node) === undefined ? undefined : getTestCallback(node);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Stack of callback function nodes for the currently open test/hook/subtest scopes. An assertion
	// is checked against the conditionals up to its nearest enclosing scope, so a subtest's body is
	// scoped to the subtest, not to a conditional wrapping the subtest call in the outer test.
	const testCallbackStack = [];
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const boundaryCallback = getScopeBoundaryCallback(node, imports);
		if (boundaryCallback) {
			testCallbackStack.push(boundaryCallback);
			return;
		}

		// Not a test/subtest call — check if it's an assertion inside a test.
		if (testCallbackStack.length === 0) {
			return;
		}

		if (!parseAssertionCall(node, imports) || !isAssertionCallWithSupportedContext(node, tracker)) {
			return;
		}

		const testCallback = testCallbackStack.at(-1);

		// Walk ancestors from this assertion up to (but not including) the test callback.
		let child = node;
		let current = node.parent;

		while (current && current !== testCallback) {
			// Loops count here: an assertion in a loop body may run zero or many times.
			if (isConditionalBranch(current, child, {includeLoops: true})) {
				return {
					node,
					messageId: MESSAGE_ID,
				};
			}

			child = current;
			current = current.parent;
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);

		const boundaryCallback = getScopeBoundaryCallback(node, imports);
		if (boundaryCallback && testCallbackStack.at(-1) === boundaryCallback) {
			testCallbackStack.pop();
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow assertions inside conditional code within a test.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

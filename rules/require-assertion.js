import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	parseSupportedAssertionCall,
	getCalleeChain,
	getDestructuredAssertBindings,
	createContextTracker,
} from './utils/node-test.js';

const MESSAGE_ID = 'require-assertion/error';

const messages = {
	[MESSAGE_ID]: 'Test is missing an assertion. Tests without assertions will always pass.',
};

/*
Whether a call reaches the context `assert` through a destructured binding in one of the open test
frames.

`parseSupportedAssertionCall` resolves this through the context tracker, which only knows the
innermost callback. A test declared inside another test still sees the outer binding, so the frames
are searched here instead. The shape is the same one the shared helper accepts: a bare destructured
method or `assert.method(…)`.
*/
function isDestructuredAssertCall(node, testStack, sourceCode) {
	const chain = getCalleeChain(node.callee);
	if (!chain || chain.members.length > 1) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(chain.root), chain.root);
	if (variable === null) {
		return false;
	}

	const isBareMethodCall = chain.members.length === 0;
	return testStack.some(test => {
		if (!test.assertBindings.has(variable)) {
			return false;
		}

		// A bare identifier is a destructured method, so its binding records a name. A member call is
		// a method on the assert object, whose binding records none.
		const method = test.assertBindings.get(variable);
		return isBareMethodCall ? typeof method === 'string' : method === undefined;
	});
}

function getContainingTestFrame(node, testStack) {
	return testStack.findLast(test => {
		for (let current = node.parent; current; current = current.parent) {
			if (current === test.callback) {
				return true;
			}
		}

		return false;
	});
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	/*
	Stack of state for each open test call.
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
				testStack.push({
					callNode: node,
					callback,
					assertBindings: getDestructuredAssertBindings(callback, imports),
					hasAssertion: false,
				});
				return;
			}

			// No inline callback: skip/todo or external implementation — don't report.
			return;
		}

		const currentTest = getContainingTestFrame(node, testStack);
		if (!currentTest) {
			return;
		}

		// Check if this call is an assertion.
		if (
			parseSupportedAssertionCall(node, imports, tracker)
			|| isDestructuredAssertCall(node, testStack, sourceCode)
		) {
			currentTest.hasAssertion = true;
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

		// A nested test call does not count as an assertion in its parent.
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

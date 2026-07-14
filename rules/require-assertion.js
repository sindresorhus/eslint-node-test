import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	parseAssertionCall,
	getCalleeChain,
	createContextTracker,
	isAssertionCallWithSupportedContext,
} from './utils/node-test.js';

const MESSAGE_ID = 'require-assertion/error';

const messages = {
	[MESSAGE_ID]: 'Test is missing an assertion. Tests without assertions will always pass.',
};

function getDestructuredAssertVariable(callback, sourceCode) {
	const parameter = callback.params[0];
	if (parameter?.type !== 'ObjectPattern') {
		return undefined;
	}

	const property = parameter.properties.find(property =>
		property.type === 'Property'
		&& !property.computed
		&& property.key.type === 'Identifier'
		&& property.key.name === 'assert'
		&& property.value.type === 'Identifier');

	if (!property) {
		return undefined;
	}

	return findVariable(sourceCode.getScope(property.value), property.value);
}

function isDestructuredAssertCall(node, testStack, sourceCode) {
	const chain = getCalleeChain(node.callee);
	if (!chain || chain.members.length !== 1) {
		return false;
	}

	const variable = findVariable(sourceCode.getScope(chain.root), chain.root);
	return variable !== null && testStack.some(test => test.assertVariable === variable);
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
					assertVariable: getDestructuredAssertVariable(callback, sourceCode),
					hasAssertion: false,
				});
				return;
			}

			// No inline callback: skip/todo or external implementation — don't report.
			return;
		}

		// Check if this call is an assertion.
		const isAssertion = (
			(parseAssertionCall(node, imports) && isAssertionCallWithSupportedContext(node, tracker))
			|| isDestructuredAssertCall(node, testStack, sourceCode)
		);
		if (!isAssertion) {
			return;
		}

		const currentTest = getContainingTestFrame(node, testStack);
		if (currentTest) {
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

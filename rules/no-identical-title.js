import {
	resolveImports,
	parseTestCall,
	getTestTitle,
	getStaticString,
	getTestCallback,
	createContextTracker,
} from './utils/node-test.js';

const MESSAGE_ID = 'no-identical-title/duplicate';

const messages = {
	[MESSAGE_ID]: 'Test title is already used by another test in the same scope.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	/*
	Stack of title sets, one per scope level.
	The bottom of the stack (index 0) is the module top-level.
	Each describe/suite callback body pushes a new set on entry and pops it on exit.
	*/
	const scopeStack = [new Set()];

	/*
	Map from a suite callback function node to the call expression that created it,
	so we can push/pop the scope when entering/exiting the callback body.
	*/
	const suiteCallbackNodes = new WeakSet();

	// A subtest (`t.test(…)`) is a test with a title and its own scope for its children, exactly like
	// an imported test, so it is tracked through the context tracker.
	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		if ((!parsed && !isSubtest) || parsed?.kind === 'hook') {
			return;
		}

		// Track suite and subtest callbacks for scope push/pop.
		if (parsed?.kind === 'suite' || isSubtest) {
			const callback = getTestCallback(node);
			if (callback) {
				suiteCallbackNodes.add(callback);
			}
		}

		const titleNode = getTestTitle(node, context);
		if (!titleNode) {
			return;
		}

		const titleValue = getStaticString(titleNode, context);
		if (titleValue === undefined) {
			return;
		}

		const currentScope = scopeStack.at(-1);
		if (currentScope.has(titleValue)) {
			return {
				node: titleNode,
				messageId: MESSAGE_ID,
			};
		}

		currentScope.add(titleValue);
	});

	// Push/pop a scope around each suite callback body.
	const functionTypes = ['FunctionExpression', 'ArrowFunctionExpression'];

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});

	context.on(functionTypes, node => {
		if (suiteCallbackNodes.has(node)) {
			scopeStack.push(new Set());
		}
	});

	context.onExit(functionTypes, node => {
		if (suiteCallbackNodes.has(node)) {
			scopeStack.pop();
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow identical test titles within the same scope.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

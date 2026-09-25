import {
	resolveImports,
	parseTestCall,
	getTestTitle,
	getStaticString,
	getTestCallback,
	createContextTracker,
	isOutOfLineCallback,
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
	Each suite or test callback body pushes a new set on entry and pops it on exit: the tests
	registered inside one belong to that suite or test, not to the level that encloses it.
	*/
	const scopeStack = [new Set()];

	/*
	The callback function nodes that open a title scope, so the scope is pushed when the body is
	entered and popped when it is left.
	*/
	const scopeCallbackNodes = new WeakSet();

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

		// Suite and test callbacks (imported tests and subtests alike) open a title scope.
		if (parsed?.kind === 'suite' || parsed?.kind === 'test' || isSubtest) {
			const callback = getTestCallback(node);
			if (callback) {
				scopeCallbackNodes.add(callback);
			}
		}

		const titleNode = getTestTitle(node, context);
		if (!titleNode) {
			return;
		}

		const titleValue = getStaticString(titleNode, context);
		// An empty title is not the name the runner uses: `node:test` falls back to the callback's
		// function name, so two empty titles are usually two different names.
		if (titleValue === undefined || titleValue === '') {
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

	// Push/pop a scope around each suite or test callback body, including one the call names out of
	// line (`test('a', body)`), which the traversal reaches wherever it is declared.
	const functionTypes = ['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration'];

	const opensScope = node => scopeCallbackNodes.has(node) || isOutOfLineCallback(node, context, imports);

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});

	context.on(functionTypes, node => {
		if (opensScope(node)) {
			scopeStack.push(new Set());
		}
	});

	context.onExit(functionTypes, node => {
		if (opensScope(node)) {
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

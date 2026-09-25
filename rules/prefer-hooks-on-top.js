import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	createContextTracker,
	isContextHookCall,
	getCalleeChain,
} from './utils/node-test.js';

const MESSAGE_ID = 'prefer-hooks-on-top';

const messages = {
	[MESSAGE_ID]: 'Hook `{{name}}` should come before any test or `describe` in its scope.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Stack of scopes; each tracks whether a test/suite has appeared in it yet.
	const scopeStack = [{seenTest: false}];
	const pushedCalls = new Set();

	// A subtest (`t.test(…)`) is a test, and a hook declared on a context (`t.beforeEach(…)`) is a
	// hook; both are method calls, so the tracker recognizes them alongside the imported forms.
	const tracker = createContextTracker(imports, {trackHooks: true});
	const getContextHookName = node => getCalleeChain(node.callee)?.members[0]?.name;

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		if (!parsed && !isSubtest && !isContextHook) {
			return;
		}

		const scope = scopeStack.at(-1);

		let problem;
		if (isContextHook) {
			if (scope.seenTest) {
				problem = {node, messageId: MESSAGE_ID, data: {name: getContextHookName(node)}};
			}
		} else if (parsed?.kind === 'hook' && scope.seenTest) {
			problem = {
				node,
				messageId: MESSAGE_ID,
				data: {name: parsed.name},
			};
		}

		if (isSubtest || parsed?.kind === 'test' || parsed?.kind === 'suite') {
			scope.seenTest = true;

			const callback = getTestCallback(node);
			if (callback) {
				scopeStack.push({seenTest: false});
				pushedCalls.add(node);
			}
		}

		return problem;
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);

		if (!pushedCalls.has(node)) {
			return;
		}

		pushedCalls.delete(node);
		scopeStack.pop();
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Require hooks to be declared before the tests in their scope.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

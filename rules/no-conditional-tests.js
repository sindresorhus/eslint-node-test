import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	nearestTestCallbackKind,
	isContextHookCall,
} from './utils/node-test.js';
import isConditionalBranch from './utils/is-conditional-branch.js';
import isFunction from './ast/is-function.js';

const MESSAGE_ID = 'no-conditional-tests';

const messages = {
	[MESSAGE_ID]: 'Do not register a {{kind}} conditionally; it makes the suite structure non-deterministic.',
};

/*
Whether a conditional construct guards `node`, searching up to the enclosing function. Loops are
intentionally ignored: iterating to register tests is the idiomatic way to write table-driven tests
in `node:test`.
*/
function isConditionallyRegistered(node) {
	let current = node;
	let {parent} = current;
	while (parent) {
		if (isFunction(parent)) {
			return false;
		}

		if (isConditionalBranch(parent, current)) {
			return true;
		}

		current = parent;
		({parent} = current);
	}

	return false;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Subtests (`t.test(…)`) and context hooks (`t.beforeEach(…)`) register conditionally just like the
	// imported forms, so a condition around them is equally non-deterministic.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);
		const isContextHook = isContextHookCall(node, tracker.isContextReceiver);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		if (!parsed && !isSubtest && !isContextHook) {
			return;
		}

		// A definition inside a hook is `no-test-inside-hook`'s to report. Its fix (move the definition
		// out of the hook) has to come first, and this rule's advice (move the condition into the
		// body) would leave that report in place, so reporting both leaves no state the user can reach.
		if (nearestTestCallbackKind(node, imports, tracker.isContextReceiver, context) === 'hook') {
			return;
		}

		if (!isConditionallyRegistered(node)) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
			data: {kind: isSubtest ? 'test' : (isContextHook ? 'hook' : parsed.kind)},
		};
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow conditionally registering tests, suites, and hooks.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

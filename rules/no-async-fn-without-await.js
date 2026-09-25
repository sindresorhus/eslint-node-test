import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	createContextTracker,
	isContextHookCall,
} from './utils/node-test.js';
import containsSuspensionPoint from './utils/contains-suspension-point.js';

const MESSAGE_ID = 'no-async-fn-without-await/error';
const MESSAGE_ID_SUGGESTION = 'no-async-fn-without-await/suggestion';

const messages = {
	[MESSAGE_ID]: 'Async test/hook function has no `await` expression.',
	[MESSAGE_ID_SUGGESTION]: 'Remove the `async` keyword.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Subtests (`t.test(…)`) and context hooks (`t.beforeEach(…)`) are method calls on a context
	// parameter, not imported bindings, so the tracker is needed to see them alongside the imported
	// `test`/`it` and `before`/`after` spellings.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		// Query the tracker before it learns about this call, so the receiver is the enclosing context.
		const isSubtest = tracker.isSubtestCall(node);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		const isContextHook = isContextHookCall(node, tracker.isContextIdentifier);
		// Suites are handled by `no-async-describe`, which forbids an async `describe` callback
		// outright (the runner never awaits it), so skip them here to avoid a duplicate report.
		if ((!parsed && !isSubtest && !isContextHook) || parsed?.kind === 'suite') {
			return;
		}

		const callback = getTestCallback(node);
		if (!callback?.async) {
			return;
		}

		// Check if the async function body contains any suspension point at its own level.
		// containsSuspensionPoint does not descend into nested functions.
		if (containsSuspensionPoint(callback.body, sourceCode.visitorKeys)) {
			return;
		}

		// A method shorthand (`async fn() {}`) keeps the `async` keyword and the method name on the
		// surrounding `Property`; the function value's own range starts at the parameter list, so the
		// keyword is only reachable from the property.
		const functionNode = callback.parent?.type === 'Property' && callback.parent.value === callback
			? callback.parent
			: callback;

		const asyncToken = sourceCode.getFirstToken(functionNode, token => token.value === 'async');

		const problem = {
			node: asyncToken,
			messageId: MESSAGE_ID,
		};

		// Removing the `async` keyword also removes the gap up to the next token, so a comment there
		// would be lost with it.
		const nextToken = sourceCode.getTokenAfter(asyncToken);
		const asyncEnd = sourceCode.getRange(asyncToken)[1];
		const hasCommentInGap = sourceCode.getCommentsBefore(nextToken)
			.some(comment => sourceCode.getRange(comment)[0] >= asyncEnd);

		if (!hasCommentInGap) {
			problem.suggest = [
				{
					messageId: MESSAGE_ID_SUGGESTION,
					/** @param {import('eslint').Rule.RuleFixer} fixer */
					fix(fixer) {
						return fixer.removeRange([sourceCode.getRange(asyncToken)[0], sourceCode.getRange(nextToken)[0]]);
					},
				},
			];
		}

		return problem;
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow async test/hook functions that have no `await` expression.',
			recommended: 'unopinionated',
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

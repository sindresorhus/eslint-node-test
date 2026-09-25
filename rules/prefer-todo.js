import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getTestOptions,
	getTestTitle,
	createContextTracker,
} from './utils/node-test.js';
import {removeArgument} from './fix/index.js';

const MESSAGE_ID_ERROR = 'prefer-todo/error';
const MESSAGE_ID_SUGGESTION = 'prefer-todo/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: 'Empty placeholder test. Use `.todo` to mark it as unfinished.',
	[MESSAGE_ID_SUGGESTION]: 'Mark as `.todo`.',
};

/** Whether a comment sits in the argument gap that removing `argument` would take with it. */
function hasCommentBefore(argument, sourceCode) {
	const previousTokenEnd = sourceCode.getRange(sourceCode.getTokenBefore(argument))[1];
	return sourceCode.getCommentsBefore(argument).some(comment => sourceCode.getRange(comment)[0] > previousTokenEnd);
}

/** The object-form descriptor keys, which carry no intent of their own. */
const DESCRIPTOR_KEYS = new Set(['fn', 'name']);

/**
Whether a call passes an options object that marks the test as deliberate.

`name` and `fn` are the descriptor keys rather than intent: the object form
`test({name, fn})` is a whole descriptor, and `test('title', {fn})` passes the callback in the
options slot. Either way a `name`/`fn`-only object says nothing about intent, while any other
property (`skip`, `todo`, `timeout`, …) does.
*/
function hasIntentOptions(callExpression) {
	const options = getTestOptions(callExpression);
	return Boolean(options) && options.properties.some(property =>
		property.type !== 'Property'
		|| property.computed
		|| !DESCRIPTOR_KEYS.has(property.key.name ?? property.key.value),
	);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// A subtest (`t.test(…)`) is a test too, so an empty one is reported, but it has no `.todo`
	// method, so no `.todo` suggestion is offered for it.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		// Only plain tests (a placeholder suite is a different concept); an existing modifier is
		// intentional. A subtest has no parsed form here, so it always passes this gate.
		if (!isSubtest && (parsed?.kind !== 'test' || parsed.hasExpectedFailure || parsed.modifiers.length > 0)) {
			return;
		}

		// A `.todo` needs a title to be meaningful.
		if (!getTestTitle(node, context)) {
			return;
		}

		// An options object (`test('title', {skip: true}, …)`) marks intent, so leave it alone.
		if (hasIntentOptions(node)) {
			return;
		}

		const callback = getTestCallback(node);

		// `test('title')` — only a title, no implementation.
		const isTitleOnly = !callback && node.arguments.length === 1;

		// `test('title', () => {})` — an empty implementation body.
		const hasEmptyBody = callback?.body.type === 'BlockStatement' && callback.body.body.length === 0;

		if (!isTitleOnly && !hasEmptyBody) {
			return;
		}

		const {callee} = node;
		// Dropping the function also drops the gaps on either side of it, so a comment in either one
		// would be left behind describing the title instead.
		// A subtest has no `.todo` method, so the suggestion is not offered for it.
		const canFix = !isSubtest && (!callback || (
			sourceCode.getCommentsInside(callback).length === 0
			&& !hasCommentBefore(callback, sourceCode)
			&& sourceCode.getCommentsAfter(callback).length === 0
		));

		const problem = {
			node,
			messageId: MESSAGE_ID_ERROR,
		};

		if (canFix) {
			problem.suggest = [
				{
					messageId: MESSAGE_ID_SUGGESTION,
					* fix(fixer) {
						yield fixer.insertTextAfter(callee, '.todo');
						if (callback) {
							yield removeArgument(fixer, callback, context);
						}
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
			description: 'Prefer `.todo` for empty placeholder tests.',
			recommended: true,
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

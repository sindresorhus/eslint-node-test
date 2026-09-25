import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getTestOptions,
	findOptionsProperty,
	getTestTitle,
	createContextTracker,
} from './utils/node-test.js';
import {removeArgument} from './fix/index.js';

const MESSAGE_ID_ERROR = 'prefer-todo/error';
const MESSAGE_ID_ERROR_SUBTEST = 'prefer-todo/error-subtest';
const MESSAGE_ID_SUGGESTION = 'prefer-todo/suggestion';
const MESSAGE_ID_SUGGESTION_SUBTEST = 'prefer-todo/suggestion-subtest';

const messages = {
	[MESSAGE_ID_ERROR]: 'Empty placeholder test. Use `.todo` to mark it as unfinished.',
	[MESSAGE_ID_ERROR_SUBTEST]: 'Empty placeholder subtest. Use the `todo` option to mark it as unfinished.',
	[MESSAGE_ID_SUGGESTION]: 'Mark as `.todo`.',
	[MESSAGE_ID_SUGGESTION_SUBTEST]: 'Mark with `{todo: true}`.',
};

/*
Whether a comment sits in the argument gap that removing `argument` would take with it.

The comparison is inclusive because a comment may begin exactly where the previous token ends, which
is what a comment written flush against the comma after the title does.
*/
function hasCommentBefore(argument, sourceCode) {
	const previousTokenEnd = sourceCode.getRange(sourceCode.getTokenBefore(argument))[1];
	return sourceCode.getCommentsBefore(argument).some(comment => sourceCode.getRange(comment)[0] >= previousTokenEnd);
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

/**
Whether a call names its implementation through an `fn` in the options, whatever the value is.

`getTestCallback` can only return a function node, so a bare binding in an `fn` slot reads as no
callback at all. `node:test` runs the binding, so the test is not a placeholder.
*/
function hasNamedImplementation(callExpression) {
	return findOptionsProperty(getTestOptions(callExpression), 'fn') !== undefined;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// A subtest (`t.test(…)`) is a test too, so an empty one is reported. Its TODO form is the
	// `todo` option on the subtest call, since `t.test` has no `.todo` method.
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
		const isTitleOnly = !callback && !hasNamedImplementation(node) && node.arguments.length === 1;

		// `test('title', () => {})` — an empty implementation body.
		const hasEmptyBody = callback?.body.type === 'BlockStatement' && callback.body.body.length === 0;

		if (!isTitleOnly && !hasEmptyBody) {
			return;
		}

		const {callee} = node;
		// Dropping the function also drops the gaps on either side of it, so a comment in either one
		// would be left behind describing the title instead.
		// The subtest rewrite puts `{todo: true}` where the callback stands, so the callback has to be
		// a positional argument rather than an `fn` inside the options object.
		const isPositionalCallback = !callback || node.arguments.includes(callback);
		const canFix = (isSubtest ? isPositionalCallback : true) && (!callback || (
			sourceCode.getCommentsInside(callback).length === 0
			&& !hasCommentBefore(callback, sourceCode)
			&& sourceCode.getCommentsAfter(callback).length === 0
		));

		const problem = {
			node,
			messageId: isSubtest ? MESSAGE_ID_ERROR_SUBTEST : MESSAGE_ID_ERROR,
		};

		if (canFix) {
			problem.suggest = [
				{
					messageId: isSubtest ? MESSAGE_ID_SUGGESTION_SUBTEST : MESSAGE_ID_SUGGESTION,
					* fix(fixer) {
						if (isSubtest) {
							// `t.test('a', …)` becomes `t.test('a', {todo: true})`, which keeps the
							// subtest and reports it as a pending TODO.
							yield callback
								? fixer.replaceText(callback, '{todo: true}')
								: fixer.insertTextAfter(node.arguments.at(-1), ', {todo: true}');
							return;
						}

						// A test binding `test(…)` becomes `test.todo(…)`.
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

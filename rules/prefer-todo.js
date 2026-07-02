import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getTestOptions,
	getTestTitle,
} from './utils/node-test.js';
import {removeArgument} from './fix/index.js';

const MESSAGE_ID_ERROR = 'prefer-todo/error';
const MESSAGE_ID_SUGGESTION = 'prefer-todo/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: 'Empty placeholder test. Use `.todo` to mark it as unfinished.',
	[MESSAGE_ID_SUGGESTION]: 'Mark as `.todo`.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		// Only plain tests (a placeholder suite is a different concept); an existing modifier is intentional.
		if (parsed?.kind !== 'test' || parsed.modifiers.length > 0) {
			return;
		}

		// A `.todo` needs a title to be meaningful.
		if (!getTestTitle(node, context)) {
			return;
		}

		// An options object (`test('title', {skip: true}, …)`) marks intent, so leave it alone.
		if (getTestOptions(node)) {
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
		// Dropping the function would drop any comments inside its body, so skip the fix then.
		const canFix = !callback || sourceCode.getCommentsInside(callback).length === 0;

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

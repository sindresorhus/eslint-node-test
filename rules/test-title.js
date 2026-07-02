import quoteJsString from 'quote-js-string';
import {
	resolveImports,
	parseTestCall,
	getTestTitle,
	getTestCallback,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID_MISSING = 'test-title/missing';
const MESSAGE_ID_NOT_STRING = 'test-title/not-string';
const MESSAGE_ID_EMPTY = 'test-title/empty';
const MESSAGE_ID_WHITESPACE = 'test-title/whitespace';

const messages = {
	[MESSAGE_ID_MISSING]: 'Test must have a title.',
	[MESSAGE_ID_NOT_STRING]: 'Test title must be a string.',
	[MESSAGE_ID_EMPTY]: 'Test title must not be empty.',
	[MESSAGE_ID_WHITESPACE]: 'Test title must not have leading or trailing whitespace.',
};

/*
Validate the resolved static title string of a `titleNode` (a string `Literal` or `TemplateLiteral`).
Returns a problem for an empty or untrimmed title, or `undefined` when it is fine or not statically
resolvable.
*/
function getStaticTitleProblem(titleNode) {
	let titleValue;
	if (titleNode.type === 'Literal') {
		titleValue = titleNode.value;
	} else if (titleNode.type === 'TemplateLiteral' && titleNode.expressions.length === 0) {
		titleValue = titleNode.quasis[0].value.cooked;
	} else {
		// A template literal with expressions or some other dynamic node — can't validate.
		return;
	}

	if (titleValue === null || titleValue === undefined) {
		return;
	}

	if (titleValue.trim() === '') {
		return {
			node: titleNode,
			messageId: MESSAGE_ID_EMPTY,
		};
	}

	if (titleValue !== titleValue.trim()) {
		const trimmed = titleValue.trim();
		// Preserve the original string delimiter; a template literal (no expressions here) becomes
		// a normal single-quoted string.
		const quote = titleNode.type === 'Literal' ? titleNode.raw[0] : '\'';
		return {
			node: titleNode,
			messageId: MESSAGE_ID_WHITESPACE,
			fix: fixer => fixer.replaceText(titleNode, quoteJsString(trimmed, quote)),
		};
	}
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed || parsed.kind === 'hook') {
			return;
		}

		const firstArgument = node.arguments[0];

		// No arguments at all — truly empty call, skip.
		if (!firstArgument) {
			return;
		}

		// If the first argument is the implementation (callback), title is missing.
		const callback = getTestCallback(node);
		if (callback && callback === firstArgument) {
			return {
				node,
				messageId: MESSAGE_ID_MISSING,
			};
		}

		// First arg is an options object (possibly TypeScript-wrapped) with no preceding string title.
		if (unwrapTypeScriptExpression(firstArgument).type === 'ObjectExpression') {
			return {
				node,
				messageId: MESSAGE_ID_MISSING,
			};
		}

		const titleNode = getTestTitle(node, context);

		// First argument exists but is not a string (e.g. a number, boolean).
		if (!titleNode) {
			// If first argument is a function or identifier pointing to a fn, that's already handled above.
			// For non-string literals (numbers, booleans, null), report.
			if (
				firstArgument.type === 'Literal'
				&& typeof firstArgument.value !== 'string'
			) {
				return {
					node: firstArgument,
					messageId: MESSAGE_ID_NOT_STRING,
				};
			}

			// Dynamic/computed title — can't validate statically, skip.
			return;
		}

		return getStaticTitleProblem(titleNode);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Require tests to have a title.',
			recommended: true,
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

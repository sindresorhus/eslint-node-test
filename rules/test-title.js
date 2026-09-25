import quoteJsString from 'quote-js-string';
import {
	resolveImports,
	parseTestCall,
	getTestTitle,
	getTestCallback,
	createContextTracker,
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

	// A subtest (`t.test(…)`) is rendered in the test output exactly like an imported test, so a
	// missing/empty title is just as unreadable; it is recognized through the context tracker.
	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		if ((!parsed && !isSubtest) || parsed?.kind === 'hook') {
			return;
		}

		const firstArgument = node.arguments[0];

		// No arguments at all — truly empty call, skip.
		if (!firstArgument) {
			return;
		}

		// The object form carries its title in the descriptor's `name`, and `options.name` overrides
		// a positional title, so let `getTestTitle` resolve the title from every slot `node:test`
		// reads it from.
		const titleNode = getTestTitle(node, context);
		if (titleNode) {
			return getStaticTitleProblem(titleNode);
		}

		// The first argument is the implementation and nothing named the test.
		const callback = getTestCallback(node);
		if (callback === firstArgument) {
			return {
				node,
				messageId: MESSAGE_ID_MISSING,
			};
		}

		// A descriptor with no `name` is an object first argument that carries no title.
		if (unwrapTypeScriptExpression(firstArgument).type === 'ObjectExpression') {
			return {
				node,
				messageId: MESSAGE_ID_MISSING,
			};
		}

		// First argument exists but is not a string (e.g. a number, boolean).
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

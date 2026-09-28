import {getStaticValue} from '@eslint-community/eslint-utils';
import quoteJsString from 'quote-js-string';
import {
	resolveImports,
	parseTestCall,
	getTestTitleNode,
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
Validate the node `node:test` reads a test's title from. Returns a problem for a title that is
statically not a string, empty, or untrimmed, or `undefined` when it is fine or not statically
resolvable.

`node:test` names a test `<anonymous>` for any title that is not a string, so a value that
`getStaticValue` resolves to a non-string (`undefined`, `NaN`, a number read from a constant) is as
knowable as a numeric literal.
*/
function getStaticTitleProblem(titleNode, context) {
	const {sourceCode} = context;

	let titleValue;
	if (titleNode.type === 'TemplateLiteral' && titleNode.expressions.length === 0) {
		titleValue = titleNode.quasis[0].value.cooked;
	} else if (titleNode.type === 'Literal') {
		titleValue = titleNode.value;
	} else {
		const staticValue = getStaticValue(titleNode, sourceCode.getScope(titleNode));
		if (staticValue === null) {
			// A template literal with expressions or some other dynamic node — can't validate.
			return;
		}

		// `node:test` reads a first argument that holds an object as the descriptor, and one that holds a function as the implementation, so neither is a title. An object or function in `options.name` is left alone too, which is rare enough not to tell apart.
		if (typeof staticValue.value === 'function' || (typeof staticValue.value === 'object' && staticValue.value !== null)) {
			return;
		}

		titleValue = staticValue.value;
	}

	if (typeof titleValue !== 'string') {
		return {
			node: titleNode,
			messageId: MESSAGE_ID_NOT_STRING,
		};
	}

	if (titleValue.trim() === '') {
		return {
			node: titleNode,
			messageId: MESSAGE_ID_EMPTY,
		};
	}

	if (titleValue !== titleValue.trim()) {
		// Only a title written as a string is fixed. A statically resolved one (`test(title, …)`) would be
		// written back as a fresh string literal, which cuts the title off from the value it names.
		const isWrittenString = titleNode.type === 'Literal' || (titleNode.type === 'TemplateLiteral' && titleNode.expressions.length === 0);
		if (!isWrittenString) {
			return {
				node: titleNode,
				messageId: MESSAGE_ID_WHITESPACE,
			};
		}

		// Preserve the original string delimiter; a template literal (no expressions here) becomes
		// a normal single-quoted string.
		const quote = titleNode.type === 'Literal' ? titleNode.raw[0] : '\'';
		const trimmed = titleValue.trim();
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

		// Unwrapped, so a cast or a non-null assertion cannot hide the implementation argument.
		const firstArgument = unwrapTypeScriptExpression(node.arguments[0]);

		// No arguments at all — truly empty call, skip.
		if (!firstArgument) {
			return;
		}

		// The object form carries its title in the descriptor's `name`, and `options.name` overrides
		// a positional title, so resolve the title node from every slot `node:test` reads it from.
		const titleNode = getTestTitleNode(node);
		if (titleNode) {
			return getStaticTitleProblem(titleNode, context);
		}

		// The first argument is the implementation and nothing named the test.
		const callback = getTestCallback(node);
		if (callback === firstArgument) {
			return {
				node,
				messageId: MESSAGE_ID_MISSING,
			};
		}

		// A descriptor with no `name` is an object first argument that carries no title. A spread or
		// computed key could supply one, and `node:test` spreads the descriptor, so the title is not
		// statically known.
		if (
			firstArgument.type === 'ObjectExpression'
			&& firstArgument.properties.every(property => property.type !== 'SpreadElement' && !property.computed)
		) {
			return {
				node,
				messageId: MESSAGE_ID_MISSING,
			};
		}

		// The title comes from a slot this helper cannot pin down, or the title is dynamic — skip.
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

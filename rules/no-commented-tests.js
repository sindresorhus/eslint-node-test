import getComments from './utils/get-comments.js';

const MESSAGE_ID = 'no-commented-tests/error';

const messages = {
	[MESSAGE_ID]: 'Use `.skip()` or remove the commented-out test instead of commenting it out.',
};

// Matches lines that look like commented-out test/hook calls from node:test.
// Anchored at start-of-line (with optional leading whitespace and block comment asterisk).
// Matches: test(, it(, describe(, suite(, before(, after(, beforeEach(, afterEach(
// and dotted modifier variants like test.only(, it.skip(, describe.todo(, etc.
// Only the real node:test modifiers are allowed in the chain, so unrelated method calls like
// `it.each(` or `test.config(` are not misidentified as commented-out tests.
const COMMENTED_TEST_PATTERN = /^\s*\*?\s*(?:test|it|describe|suite|before|after|beforeEach|afterEach)\s*(?:\.\s*(?:only|skip|todo)\s*)*\(/v;

// Reports the first line of the comment that looks like a commented-out test.
function reportFirstMatch(context, comment) {
	const lines = comment.value.split('\n');
	const commentStartLine = context.sourceCode.getLoc(comment).start.line;
	for (const [index, line] of lines.entries()) {
		if (COMMENTED_TEST_PATTERN.test(line)) {
			context.report({
				loc: {
					line: commentStartLine + index,
					column: 0,
				},
				messageId: MESSAGE_ID,
			});
			return;
		}
	}
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	context.on('Program:exit', () => {
		for (const comment of getComments(context)) {
			// Skip JSDoc-style block comments (/** ... */).
			if (comment.type === 'Block' && context.sourceCode.getText(comment).startsWith('/**')) {
				continue;
			}

			reportFirstMatch(context, comment);
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow commented-out tests.',
			recommended: false,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

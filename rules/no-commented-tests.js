import getComments from './utils/get-comments.js';

const MESSAGE_ID = 'no-commented-tests/error';

const messages = {
	[MESSAGE_ID]: 'Use `.skip()` or remove the commented-out test instead of commenting it out.',
};

// Matches lines that look like commented-out test/hook calls from node:test.
// Anchored at start-of-line (with optional leading whitespace and block comment asterisk).
// Matches: `test(`, `it(`, `describe(`, `suite(`, `before(`, `after(`, `beforeEach(`, `afterEach(`,
// and dotted chains of real node:test test and hook names: a modifier like `test.only(` or
// `it.skip(`, or a static export the test function carries, like a chained `describe` or
// `beforeEach` after a test binding. A non-test export such as `test.snapshot(` is documentation of
// that API, not dead test code.
// Only real node:test names are allowed in the chain, so unrelated method calls like `it.each(` or
// `test.config(` are not misidentified as commented-out tests, and neither is `describe.name(…)`,
// since `Function.prototype` has no node:test export names.
// A leading `await` is part of the real spelling of a top-level test in an ES module.
// No space is allowed before the `(`, because real code never writes `test (` while prose
// routinely does — `// test (the runner entry point)` is a sentence, not a commented-out test.
const CHAINED_NAME = '(?:only|skip|todo|describe|suite|before|after|beforeEach|afterEach|expectFailure)';
const COMMENTED_TEST_PATTERN = new RegExp(
	String.raw`^\s*\*?\s*(?:await\s+)?(?:test|it|describe|suite|before|after|beforeEach|afterEach)(?:\s*\.\s*${CHAINED_NAME}\s*)*\(`,
	'v',
);

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

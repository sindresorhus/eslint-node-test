import {resolveImports} from './utils/node-test.js';
import getComments from './utils/get-comments.js';

const MESSAGE_ID = 'no-commented-tests/error';

const messages = {
	[MESSAGE_ID]: 'Use `.skip()` or remove the commented-out test instead of commenting it out.',
};

// The `node:test` exports whose calls are tests, suites, or hooks. A commented-out call names the
// *local* binding, so an aliased import is covered by adding the alias to the pattern.
const TEST_EXPORTS = ['test', 'it', 'describe', 'suite', 'before', 'after', 'beforeEach', 'afterEach'];
const TEST_EXPORTS_SET = new Set(TEST_EXPORTS);

// Matches lines that look like commented-out test/hook calls from node:test.
// Anchored at start-of-line (with optional leading whitespace and block comment asterisk).
// Matches: `test(`, `it(`, `describe(`, `suite(`, `before(`, `after(`, `beforeEach(`, `afterEach(`, and dotted chains of real node:test test and hook names: a modifier like `test.only(` or `it.skip(`, or a static export the test function carries, like a chained `describe` or `beforeEach` after a test binding. A non-test export such as `test.snapshot(` is documentation of that API, not dead test code. Only real node:test names are allowed in the chain, so unrelated method calls like `it.each(` or `test.config(` are not misidentified as commented-out tests, and neither is `describe.name(…)`, since `Function.prototype` has no node:test export names. A leading `await` is part of the real spelling of a top-level test in an ES module. No space is allowed before the `(`, because real code never writes `test (` while prose routinely does: `// test (the runner entry point)` is a sentence, not a commented-out test. The statics a test function carries: `test.test()` and `test.it()` register a test exactly as `test()` does, and the rest are the modifiers and the other entry points.
const CHAINED_NAME = '(?:only|skip|todo|test|it|describe|suite|before|after|beforeEach|afterEach|expectFailure)';

/**
Build the pattern for one file, whose `node:test` imports may bind an export to another name.
*/
function createPattern(imports) {
	// A local binding for a test export (`import {test as t}`) is what the commented-out call names, and a namespace binding carries the same exports as the test function.
	const names = new Set(TEST_EXPORTS);
	for (const [local, canonical] of imports.locals) {
		if (TEST_EXPORTS_SET.has(canonical)) {
			names.add(local);
		}
	}

	for (const name of imports.namespaces) {
		names.add(name);
	}

	return new RegExp(
		// A long alternation sorts longest-first so an alias like `testCase` cannot shadow `test`. `$` is the only regex syntax character an identifier can hold, and `RegExp.escape` is not in Node.js 22.
		String.raw`^\s*\*?\s*(?:await\s+)?(?:${[...names].toSorted((a, b) => b.length - a.length).map(name => name.replaceAll('$', String.raw`\$`)).join('|')})(?:\s*\.\s*${CHAINED_NAME}\s*)*\(`,
		'v',
	);
}

// Reports the first line of the comment that looks like a commented-out test.
function reportFirstMatch(context, pattern, comment) {
	const lines = comment.value.split('\n');
	const commentStartLine = context.sourceCode.getLoc(comment).start.line;
	for (const [index, line] of lines.entries()) {
		if (pattern.test(line)) {
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
	const pattern = createPattern(resolveImports(context));

	context.on('Program:exit', () => {
		for (const comment of getComments(context)) {
			// Skip JSDoc-style block comments (/** ... */).
			if (comment.type === 'Block' && context.sourceCode.getText(comment).startsWith('/**')) {
				continue;
			}

			reportFirstMatch(context, pattern, comment);
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

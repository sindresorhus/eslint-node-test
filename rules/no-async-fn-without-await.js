import {resolveImports, parseTestCall, getTestCallback} from './utils/node-test.js';
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

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		// Suites are handled by `no-async-describe`, which forbids an async `describe` callback
		// outright (the runner never awaits it), so skip them here to avoid a duplicate report.
		if (!parsed || parsed.kind === 'suite') {
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

		const asyncToken = sourceCode.getFirstToken(callback, token => token.value === 'async');

		return {
			node: asyncToken,
			messageId: MESSAGE_ID,
			suggest: [
				{
					messageId: MESSAGE_ID_SUGGESTION,
					/** @param {import('eslint').Rule.RuleFixer} fixer */
					fix(fixer) {
						const nextToken = sourceCode.getTokenAfter(asyncToken);
						return fixer.removeRange([sourceCode.getRange(asyncToken)[0], sourceCode.getRange(nextToken)[0]]);
					},
				},
			],
		};
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

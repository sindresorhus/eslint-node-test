import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {isStringExpression} from './ast/index.js';

const MESSAGE_ID_ERROR = 'no-assert-throws-string/error';
const MESSAGE_ID_SUGGESTION = 'no-assert-throws-string/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: 'The second argument to `{{method}}()` is the failure message, not an error matcher, so the thrown error is not validated.',
	[MESSAGE_ID_SUGGESTION]: 'Match the error message with `{message: …}`.',
};

const THROWS_METHODS = new Set(['throws', 'rejects']);

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const parsed = parseSupportedAssertionCall(node, imports, tracker);
		if (!parsed || !THROWS_METHODS.has(parsed.method)) {
			return;
		}

		const errorArgument = node.arguments[1];
		if (!errorArgument || !isStringExpression(unwrapTypeScriptExpression(errorArgument))) {
			return;
		}

		return {
			node: errorArgument,
			messageId: MESSAGE_ID_ERROR,
			data: {method: parsed.method},
			suggest: [
				{
					messageId: MESSAGE_ID_SUGGESTION,
					/** @param {import('eslint').Rule.RuleFixer} fixer */
					fix: fixer => fixer.replaceText(errorArgument, `{message: ${sourceCode.getText(errorArgument)}}`),
				},
			],
		};
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
			description: 'Disallow a string as the error matcher of `assert.throws()`/`assert.rejects()`.',
			recommended: 'unopinionated',
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

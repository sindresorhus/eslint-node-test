import {
	resolveImports,
	parseTestCall,
	findModifier,
	getTestOptions,
	findEnabledOptionsProperty,
} from '../utils/node-test.js';

/*
Shared logic for rules that disallow a single test modifier (`only`/`skip`/`todo`).

A modifier can be applied two ways in `node:test`:
- As a chained property: `test.only(…)`.
- As an options-object property: `test('title', {only: true}, () => {})`.
*/

/**
@param {{
	modifier: 'only' | 'skip' | 'todo',
	description: string,
	errorMessage: string,
	recommended: 'unopinionated' | boolean,
}} options
@returns {import('eslint').Rule.RuleModule}
*/
export default function createTestModifierRule({modifier, description, errorMessage, recommended}) {
	const MESSAGE_ID_ERROR = `no-${modifier}-test/error`;
	const MESSAGE_ID_SUGGESTION = `no-${modifier}-test/suggestion`;
	const messages = {
		[MESSAGE_ID_ERROR]: errorMessage,
		[MESSAGE_ID_SUGGESTION]: `Remove \`.${modifier}\`.`,
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
			if (!parsed) {
				return;
			}

			const modifierNode = findModifier(parsed.modifiers, modifier);
			if (modifierNode) {
				return {
					node: modifierNode,
					messageId: MESSAGE_ID_ERROR,
					suggest: [
						{
							messageId: MESSAGE_ID_SUGGESTION,
							/** @param {import('eslint').Rule.RuleFixer} fixer */
							fix(fixer) {
								const dotToken = sourceCode.getTokenBefore(modifierNode);
								return fixer.removeRange([sourceCode.getRange(dotToken)[0], sourceCode.getRange(modifierNode)[1]]);
							},
						},
					],
				};
			}

			const property = findEnabledOptionsProperty(getTestOptions(node), modifier);
			if (property) {
				return {
					node: property,
					messageId: MESSAGE_ID_ERROR,
				};
			}
		});
	};

	return {
		create,
		meta: {
			type: 'problem',
			docs: {
				description,
				recommended,
			},
			hasSuggestions: true,
			schema: [],
			messages,
			languages: [
				'js/js',
			],
		},
	};
}

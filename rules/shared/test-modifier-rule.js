import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	findModifier,
	getTestOptions,
	findEnabledOptionsProperty,
} from '../utils/node-test.js';

/*
Shared logic for rules that disallow a single test modifier (`only`/`skip`/`todo`).

A modifier can be applied two ways in `node:test`:
- As a chained property: `test.only(…)`.
- As an options-object property: `test('title', {only: true}, () => {})`.

A subtest (`t.test(…)`) takes the same options object, so only the chained form is impossible there.
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

		// A subtest is a method call, so it takes the options form only.
		const tracker = createContextTracker(imports);

		context.on('CallExpression', node => {
			const isSubtest = tracker.isSubtestCall(node);
			tracker.update(node);

			const parsed = parseTestCall(node, imports);
			if (!parsed && !isSubtest) {
				return;
			}

			const modifierNode = parsed && findModifier(parsed.modifiers, modifier);
			if (modifierNode) {
				const memberExpression = modifierNode.parent;
				const previousToken = sourceCode.getTokenBefore(modifierNode);
				const nextToken = sourceCode.getTokenAfter(previousToken, {includeComments: true});
				const modifierRange = sourceCode.getRange(modifierNode);
				const suggest = memberExpression?.type === 'MemberExpression'
					&& !parsed.hasStandaloneModifier
					&& !memberExpression.computed
					&& memberExpression.property === modifierNode
					&& previousToken.value === '.'
					&& sourceCode.getRange(nextToken)[0] === modifierRange[0]
					? [
						{
							messageId: MESSAGE_ID_SUGGESTION,
							/** @param {import('eslint').Rule.RuleFixer} fixer */
							fix(fixer) {
								return fixer.removeRange([sourceCode.getRange(previousToken)[0], sourceCode.getRange(modifierNode)[1]]);
							},
						},
					]
					: undefined;

				return {
					node: modifierNode,
					messageId: MESSAGE_ID_ERROR,
					suggest,
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

		context.onExit('CallExpression', node => {
			tracker.leave(node);
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

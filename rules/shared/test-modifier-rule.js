import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	findModifier,
	getTestOptions,
	findEnabledOptionsProperty,
} from '../utils/node-test.js';
import {unwrapExpression} from '../utils/index.js';

/*
Shared logic for rules that disallow a single test modifier (`only`/`skip`/`todo`).

A modifier can be applied two ways in `node:test`:
- As a chained property: `test.only(…)`.
- As an options-object property: `test('title', {only: true}, () => {})`.

A subtest (`t.test(…)`) takes the same options object, so only the chained form is impossible there.

A hook has neither: `TestHook` reads only `hookType`, `loc`, `parent`, `timeout` and `signal` from its
options, so `{skip: true}` on a hook is inert. `no-unknown-test-options` reports that key instead.
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
		const tracker = createContextTracker(imports, {trackHooks: true});

		context.on('CallExpression', node => {
			const isSubtest = tracker.isSubtestCall(node);
			tracker.update(node);

			const parsed = parseTestCall(node, imports);
			// A hook has no modifier form at all: neither the chained method nor the option exists.
			if ((!parsed && !isSubtest) || parsed?.kind === 'hook') {
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
					// The modifier has to be the call itself. In `test.skip.call(…)` it is an intermediate link, and dropping it would turn a skipped test into a running one. A TypeScript wrapper on the callee (`(test.only as any)(…)`, `test.only!(…)`) is erased.
					&& memberExpression === unwrapExpression(node.callee)
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

			const property = findEnabledOptionsProperty(getTestOptions(node), modifier, context);
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

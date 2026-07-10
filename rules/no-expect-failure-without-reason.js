import {
	resolveImports,
	parseTestCall,
	getTestOptions,
	findOptionsProperty,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-expect-failure-without-reason';

const messages = {
	[MESSAGE_ID]: 'Give `expectFailure` a reason string instead of `true` explaining why.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (
			!parsed
			|| parsed.kind === 'hook'
			|| parsed.modifiers.some(modifier => modifier.name === 'expectFailure')
		) {
			return;
		}

		const property = findOptionsProperty(getTestOptions(node), 'expectFailure');
		const value = property && unwrapTypeScriptExpression(property.value);
		if (value?.type === 'Literal' && value.value === true) {
			return {
				node: property,
				messageId: MESSAGE_ID,
			};
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Require a reason when marking a test or suite as expected to fail.',
			recommended: false,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

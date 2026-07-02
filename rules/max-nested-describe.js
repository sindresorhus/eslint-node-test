import {resolveImports, parseTestCall, createSuiteDepthTracker} from './utils/node-test.js';

const MESSAGE_ID = 'max-nested-describe';

const messages = {
	[MESSAGE_ID]: 'Describe blocks are nested too deeply ({{depth}}). Maximum allowed is {{max}}.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {max} = context.options[0];

	const tracker = createSuiteDepthTracker();

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (parsed?.kind !== 'suite') {
			return;
		}

		tracker.enterSuite(node);

		if (tracker.depth > max) {
			return {
				node,
				messageId: MESSAGE_ID,
				data: {depth: tracker.depth, max},
			};
		}
	});

	context.onExit('CallExpression', node => {
		tracker.exitSuite(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Enforce a maximum depth for nested `describe` blocks.',
			recommended: true,
		},
		schema: [
			{
				type: 'object',
				properties: {
					max: {
						type: 'integer',
						minimum: 1,
						description: 'The maximum allowed depth of nested `describe` blocks.',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{max: 5}],
		messages,
		languages: ['js/js'],
	},
};

export default config;

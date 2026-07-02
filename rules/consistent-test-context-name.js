import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	getTestCallback,
} from './utils/node-test.js';

const MESSAGE_ID = 'consistent-test-context-name';

const messages = {
	[MESSAGE_ID]: 'Name the test context parameter `{{expected}}` instead of `{{actual}}`.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const expected = context.options[0].name;
	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);
		const isTest = parseTestCall(node, imports)?.kind === 'test';
		tracker.update(node);

		if (!isTest && !isSubtest) {
			return;
		}

		const parameter = getTestCallback(node)?.params[0];
		if (parameter?.type === 'Identifier' && parameter.name !== expected) {
			return {
				node: parameter,
				messageId: MESSAGE_ID,
				data: {expected, actual: parameter.name},
			};
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Enforce a consistent name for the test context parameter.',
			recommended: 'unopinionated',
		},
		schema: [
			{
				type: 'object',
				properties: {
					name: {
						type: 'string',
						description: 'The required name for the test context parameter.',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{name: 't'}],
		messages,
		languages: ['js/js'],
	},
};

export default config;

import {resolveImports, parseTestCall, createSuiteDepthTracker} from './utils/node-test.js';

const MESSAGE_ID = 'consistent-test-it';

const messages = {
	[MESSAGE_ID]: 'Prefer `{{expected}}` over `{{actual}}` {{location}}.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {fn: topLevelName, withinDescribe: withinDescribeName} = context.options[0];

	const tracker = createSuiteDepthTracker();

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed) {
			return;
		}

		let problem;
		if (parsed.kind === 'test') {
			const isInDescribe = tracker.depth > 0;
			const expected = isInDescribe ? withinDescribeName : topLevelName;
			if (parsed.name !== expected) {
				problem = {
					node,
					messageId: MESSAGE_ID,
					data: {
						expected,
						actual: parsed.name,
						location: isInDescribe ? 'inside a `describe`' : 'at the top level',
					},
				};
			}
		} else if (parsed.kind === 'suite') {
			tracker.enterSuite(node);
		}

		return problem;
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
			description: 'Enforce consistent use of `test` or `it`.',
			recommended: false,
		},
		schema: [
			{
				type: 'object',
				properties: {
					fn: {
						enum: ['test', 'it'],
						description: 'The name to use for top-level test cases.',
					},
					withinDescribe: {
						enum: ['test', 'it'],
						description: 'The name to use for test cases inside a `describe`.',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{fn: 'test', withinDescribe: 'it'}],
		messages,
		languages: ['js/js'],
	},
};

export default config;

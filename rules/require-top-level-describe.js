import {resolveImports, parseTestCall, createSuiteDepthTracker} from './utils/node-test.js';

const MESSAGE_ID_NOT_WRAPPED = 'require-top-level-describe/not-wrapped';
const MESSAGE_ID_TOO_MANY = 'require-top-level-describe/too-many';

const messages = {
	[MESSAGE_ID_NOT_WRAPPED]: 'A {{kind}} must be placed inside a top-level `describe`.',
	[MESSAGE_ID_TOO_MANY]: 'There should be no more than {{max}} top-level `describe` blocks in a file.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const maxTopLevelDescribes = context.options[0]?.maxTopLevelDescribes;

	const tracker = createSuiteDepthTracker();
	let topLevelDescribeCount = 0;

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed) {
			return;
		}

		let problem;
		if (tracker.depth === 0) {
			if (parsed.kind === 'test' || parsed.kind === 'hook') {
				problem = {
					node,
					messageId: MESSAGE_ID_NOT_WRAPPED,
					data: {kind: parsed.kind === 'hook' ? 'hook' : 'test'},
				};
			} else if (parsed.kind === 'suite') {
				topLevelDescribeCount += 1;
				if (maxTopLevelDescribes !== undefined && topLevelDescribeCount > maxTopLevelDescribes) {
					problem = {
						node,
						messageId: MESSAGE_ID_TOO_MANY,
						data: {max: maxTopLevelDescribes},
					};
				}
			}
		}

		if (parsed.kind === 'suite') {
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
			description: 'Require tests and hooks to be inside a top-level `describe`.',
			recommended: false,
		},
		schema: [
			{
				type: 'object',
				properties: {
					maxTopLevelDescribes: {
						type: 'integer',
						minimum: 1,
						description: 'The maximum number of top-level `describe` blocks allowed in a file.',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{}],
		messages,
		languages: ['js/js'],
	},
};

export default config;

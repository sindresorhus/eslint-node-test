import {
	resolveImports,
	parseTestCall,
	getTestTitle,
	getStaticString,
} from './utils/node-test.js';

const MESSAGE_ID = 'test-title-format/mismatch';

const messages = {
	[MESSAGE_ID]: 'Test title does not match the required format: `{{format}}`.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const formatOption = context.options[0]?.format;
	if (!formatOption) {
		return;
	}

	let titleRegExp;
	try {
		titleRegExp = new RegExp(formatOption, 'v');
	} catch (error) {
		throw new Error(`Invalid \`format\` option for \`test-title-format\`: ${error.message}`, {cause: error});
	}

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed || parsed.kind === 'hook') {
			return;
		}

		const titleNode = getTestTitle(node, context);
		if (!titleNode) {
			return;
		}

		const titleValue = getStaticString(titleNode, context);
		if (titleValue === undefined) {
			return;
		}

		if (!titleRegExp.test(titleValue)) {
			return {
				node,
				messageId: MESSAGE_ID,
				data: {format: String(titleRegExp)},
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
			description: 'Require test titles to match a configured pattern.',
			recommended: false,
		},
		schema: [
			{
				type: 'object',
				properties: {
					format: {
						type: 'string',
						description: 'A regular expression pattern that test titles must match.',
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

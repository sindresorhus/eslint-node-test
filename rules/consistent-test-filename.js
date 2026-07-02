import {resolveImports} from './utils/node-test.js';

const MESSAGE_ID = 'consistent-test-filename';

const messages = {
	[MESSAGE_ID]: 'Test file name `{{name}}` does not match the required pattern `{{pattern}}`.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const filename = context.physicalFilename ?? context.filename;
	// No real file (for example, linting stdin), so there is nothing to check.
	if (!filename || filename === '<input>' || filename === '<text>') {
		return;
	}

	const {pattern} = context.options[0];

	let patternRegExp;
	try {
		patternRegExp = new RegExp(pattern, 'v');
	} catch (error) {
		throw new Error(`Invalid \`pattern\` option for \`consistent-test-filename\`: ${error.message}`, {cause: error});
	}

	const name = filename.split(/[/\\]/).pop();
	if (patternRegExp.test(name)) {
		return;
	}

	context.on('Program', node => ({
		node,
		messageId: MESSAGE_ID,
		data: {name, pattern},
	}));
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Enforce a consistent test file name pattern.',
			recommended: false,
		},
		schema: [
			{
				type: 'object',
				properties: {
					pattern: {
						type: 'string',
						description: 'A regular expression the test file name must match.',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{pattern: String.raw`\.test\.[cm]?[jt]sx?$`}],
		messages,
		languages: ['js/js'],
	},
};

export default config;

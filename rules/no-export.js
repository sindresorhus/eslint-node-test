import {resolveImports} from './utils/node-test.js';

const MESSAGE_ID = 'no-export';

const messages = {
	[MESSAGE_ID]: 'Do not export from a test file.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const report = node => ({node, messageId: MESSAGE_ID});

	context.on('ExportNamedDeclaration', node => {
		// `export {}` exports nothing — it is only a marker to make a file a module. Leave it alone.
		if (!node.declaration && !node.source && node.specifiers.length === 0) {
			return;
		}

		return report(node);
	});
	context.on('ExportDefaultDeclaration', report);
	context.on('ExportAllDeclaration', report);
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow exports from test files.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

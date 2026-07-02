import {
	resolveImports,
	parseAssertionCall,
	nearestTestCallbackKind,
} from './utils/node-test.js';

const MESSAGE_ID = 'no-assert-in-describe';

const messages = {
	[MESSAGE_ID]: 'Assertion runs when the suite is built, not when a test runs. Move it into a test or hook.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		if (!parseAssertionCall(node, imports)) {
			return;
		}

		if (nearestTestCallbackKind(node, imports) !== 'suite') {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow assertions directly inside a `describe` body.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

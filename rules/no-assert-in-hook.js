import {
	resolveImports,
	parseAssertionCall,
	nearestTestCallbackKind,
} from './utils/node-test.js';

const MESSAGE_ID = 'no-assert-in-hook';

const messages = {
	[MESSAGE_ID]: 'Avoid assertions inside a hook. A hook failure is attributed to every affected test rather than reported as a focused failure. Assert inside a test instead.',
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

		if (nearestTestCallbackKind(node, imports) !== 'hook') {
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
		type: 'suggestion',
		docs: {
			description: 'Disallow assertions inside hooks.',
			recommended: false,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

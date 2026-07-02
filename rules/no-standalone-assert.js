import {resolveImports, parseAssertionCall} from './utils/node-test.js';
import isFunction from './ast/is-function.js';

const MESSAGE_ID = 'no-standalone-assert';

const messages = {
	[MESSAGE_ID]: 'Assertion runs when the module is loaded, not as part of a test. Move it into a test or hook.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile || !imports.hasAssert) {
		return;
	}

	context.on('CallExpression', node => {
		if (!parseAssertionCall(node, imports)) {
			return;
		}

		// Any enclosing function (test/hook callback or a helper) means it is not standalone.
		for (let current = node.parent; current; current = current.parent) {
			if (isFunction(current)) {
				return;
			}
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
			description: 'Disallow assertions outside of a test.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

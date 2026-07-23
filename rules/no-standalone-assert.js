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
		const parsed = parseAssertionCall(node, imports);
		// A `<receiver>.assert.*` call (`contextReceiver` set) is only a real assertion when the
		// receiver is a test context, which only exists inside a test callback — never at module
		// scope. So any such call reaching here is an unrelated object's method, not a standalone
		// `node:assert` assertion.
		if (!parsed || parsed.contextReceiver) {
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

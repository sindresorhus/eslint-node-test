import {resolveImports, parseAssertionCall} from './utils/node-test.js';

const MESSAGE_ID = 'no-useless-assertion';

const messages = {
	[MESSAGE_ID]: '`{{method}}()` is not useful. It catches an error only to rethrow it, so call the code directly instead.',
};

const USELESS_METHODS = new Set(['doesNotThrow', 'doesNotReject']);

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		const parsed = parseAssertionCall(node, imports);
		if (!parsed || !USELESS_METHODS.has(parsed.method)) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
			data: {method: parsed.method},
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow `assert.doesNotThrow()` and `assert.doesNotReject()`.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

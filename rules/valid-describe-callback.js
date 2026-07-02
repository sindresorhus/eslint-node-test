import {resolveImports, parseTestCall, getTestCallback} from './utils/node-test.js';

const MESSAGE_ID_PARAMETER = 'valid-describe-callback/parameter';
const MESSAGE_ID_RETURN = 'valid-describe-callback/return';

const messages = {
	[MESSAGE_ID_PARAMETER]: 'The `{{name}}` callback is called with no arguments. The test context is only passed to `test`/`it` callbacks.',
	[MESSAGE_ID_RETURN]: 'The `{{name}}` callback should not return a value, `node:test` ignores it. Use a block body.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', function * (node) {
		const parsed = parseTestCall(node, imports);
		if (parsed?.kind !== 'suite') {
			return;
		}

		const callback = getTestCallback(node);
		if (!callback) {
			return;
		}

		if (callback.params.length > 0) {
			yield {
				node: callback.params[0],
				messageId: MESSAGE_ID_PARAMETER,
				data: {name: parsed.name},
			};
		}

		// An arrow with an expression body implicitly returns a value.
		if (callback.type === 'ArrowFunctionExpression' && callback.body.type !== 'BlockStatement') {
			yield {
				node: callback.body,
				messageId: MESSAGE_ID_RETURN,
				data: {name: parsed.name},
			};
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Enforce valid `describe` callbacks.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

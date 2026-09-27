import {resolveImports, parseTestCall, getResolvedTestCallback} from './utils/node-test.js';

const MESSAGE_ID_RETURN = 'valid-describe-callback/return';

const messages = {
	[MESSAGE_ID_RETURN]: 'The `{{name}}` callback should not return a value, an implicit return registers tests through the returned expression instead of statements. Use a block body.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// A body named out of line can be passed to several suites, but it is one function, so it is reported once.
	const reportedCallbacks = new Set();

	context.on('CallExpression', function * (node) {
		const parsed = parseTestCall(node, imports);
		if (parsed?.kind !== 'suite') {
			return;
		}

		const callback = getResolvedTestCallback(node, context, imports);
		if (!callback || reportedCallbacks.has(callback)) {
			return;
		}

		reportedCallbacks.add(callback);

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

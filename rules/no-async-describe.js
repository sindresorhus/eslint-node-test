import {resolveImports, parseTestCall, getTestCallback} from './utils/node-test.js';

const MESSAGE_ID = 'no-async-describe';

const messages = {
	[MESSAGE_ID]: '`node:test` does not await a `{{name}}` callback, so any test registered after an `await` is silently dropped. Make the callback synchronous.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (parsed?.kind !== 'suite') {
			return;
		}

		const callback = getTestCallback(node);
		if (!callback?.async) {
			return;
		}

		return {
			node: callback,
			messageId: MESSAGE_ID,
			data: {name: parsed.name},
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow `async` `describe` callbacks.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

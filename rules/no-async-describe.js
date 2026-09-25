import {resolveImports, parseTestCall, getTestCallback} from './utils/node-test.js';

const MESSAGE_ID = 'no-async-describe';

const messages = {
	[MESSAGE_ID]: '`node:test` does await a `{{name}}` callback, so an `async` one registers its tests late and a rejection cancels them. Make the callback synchronous and do async setup in a hook.',
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

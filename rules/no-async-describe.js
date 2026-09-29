import {resolveImports, parseTestCall, getResolvedTestCallback} from './utils/node-test.js';

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

	// A body named out of line can be passed to several suites, but it is one function, so it is reported once.
	const reportedCallbacks = new Set();

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (parsed?.kind !== 'suite') {
			return;
		}

		// A callback the call names out of line is still the callback the runner awaits, wherever it is declared, so it is read as the function rather than as the name.
		const callback = getResolvedTestCallback(node, context, imports);
		if (!callback?.async || reportedCallbacks.has(callback)) {
			return;
		}

		reportedCallbacks.add(callback);

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

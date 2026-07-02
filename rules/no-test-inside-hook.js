import {resolveImports, parseTestCall, getTestCallback} from './utils/node-test.js';

const MESSAGE_ID = 'no-test-inside-hook';

const messages = {
	[MESSAGE_ID]: 'Do not define a test or suite inside a hook. Define it at the top level or inside a `describe`.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Stack of hook callback function nodes we are currently inside.
	const hookCallbackStack = [];

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed) {
			return;
		}

		if ((parsed.kind === 'test' || parsed.kind === 'suite') && hookCallbackStack.length > 0) {
			return {
				node,
				messageId: MESSAGE_ID,
			};
		}

		if (parsed.kind === 'hook') {
			const callback = getTestCallback(node);
			if (callback) {
				hookCallbackStack.push(callback);
			}
		}
	});

	context.onExit('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (parsed?.kind !== 'hook') {
			return;
		}

		const callback = getTestCallback(node);
		if (callback && hookCallbackStack.at(-1) === callback) {
			hookCallbackStack.pop();
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow defining tests and suites inside a hook.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

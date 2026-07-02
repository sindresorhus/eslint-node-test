import {resolveImports, parseTestCall, getTestCallback} from './utils/node-test.js';

const MESSAGE_ID = 'no-nested-tests/error';

const messages = {
	[MESSAGE_ID]: 'Do not define a test or suite inside a test body. Use `t.test()` for subtests instead.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Stack of callback function nodes of the `test`/`it` calls we are currently inside.
	// Suites (`describe`/`suite`) legitimately contain tests and nested suites, so they
	// do not open a scope here — only a test/it body does.
	const testCallbackStack = [];

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed) {
			return;
		}

		// A test or suite defined inside a test body should be a subtest (`t.test()`).
		if ((parsed.kind === 'test' || parsed.kind === 'suite') && testCallbackStack.length > 0) {
			return {
				node,
				messageId: MESSAGE_ID,
			};
		}

		if (parsed.kind === 'test') {
			const callback = getTestCallback(node);
			if (callback) {
				testCallbackStack.push(callback);
			}
		}
	});

	context.onExit('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed || parsed.kind !== 'test') {
			return;
		}

		const callback = getTestCallback(node);
		if (callback && testCallbackStack.at(-1) === callback) {
			testCallbackStack.pop();
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow tests and suites nested inside a test body.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

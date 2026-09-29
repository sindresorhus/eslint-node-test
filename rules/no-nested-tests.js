import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getOutOfLineCallbackCall,
	getRegistrationKind,
} from './utils/node-test.js';
import {functionTypes} from './ast/index.js';

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

	// Stack of callback function nodes of the `test`/`it` calls and subtests we are currently inside.
	// Suites (`describe`/`suite`) legitimately contain tests and nested suites, so they
	// do not open a scope here — only a test/it body does.
	const testCallbackStack = [];

	// The calls whose callbacks are on the stack, so the exit pops exactly what the entry pushed.
	const pushedCalls = new WeakSet();

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);

		// A test or suite defined inside a test body should be a subtest (`t.test()`).
		if ((parsed?.kind === 'test' || parsed?.kind === 'suite') && testCallbackStack.length > 0) {
			return {
				node,
				messageId: MESSAGE_ID,
			};
		}

		// A subtest's body is a test body too, whichever context registers it, a hook's included, the same as for a body the call names out of line below.
		if (getRegistrationKind(node, imports, context) !== 'test') {
			return;
		}

		const callback = getTestCallback(node, imports);
		if (callback) {
			testCallbackStack.push(callback);
			pushedCalls.add(node);
		}
	});

	context.onExit('CallExpression', node => {
		if (pushedCalls.delete(node)) {
			testCallbackStack.pop();
		}
	});

	// A callback the call names out of line (`test('a', body)`) is entered where it is declared, which the call's own frame does not cover, so a test inside it is still nested in that test. Only a test body nests: a suite or a hook body legitimately holds tests and suites, exactly as its inline spelling does.
	const outOfLineCallbacks = new WeakSet();

	context.on(functionTypes, node => {
		const call = getOutOfLineCallbackCall(node, context, imports);
		if (getRegistrationKind(call, imports, context) !== 'test') {
			return;
		}

		outOfLineCallbacks.add(node);
		testCallbackStack.push(node);
	});

	context.onExit(functionTypes, node => {
		if (outOfLineCallbacks.delete(node)) {
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

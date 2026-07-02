import {resolveImports, parseTestCall, getTestCallback} from './utils/node-test.js';

const MESSAGE_ID = 'prefer-hooks-on-top';

const messages = {
	[MESSAGE_ID]: 'Hook `{{name}}` should come before any test or `describe` in its scope.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Stack of scopes; each tracks whether a test/suite has appeared in it yet.
	const scopeStack = [{seenTest: false}];
	const pushedCalls = new Set();

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed) {
			return;
		}

		const scope = scopeStack.at(-1);

		let problem;
		if (parsed.kind === 'hook' && scope.seenTest) {
			problem = {
				node,
				messageId: MESSAGE_ID,
				data: {name: parsed.name},
			};
		}

		if (parsed.kind === 'test' || parsed.kind === 'suite') {
			scope.seenTest = true;

			const callback = getTestCallback(node);
			if (callback) {
				scopeStack.push({seenTest: false});
				pushedCalls.add(node);
			}
		}

		return problem;
	});

	context.onExit('CallExpression', node => {
		if (!pushedCalls.has(node)) {
			return;
		}

		pushedCalls.delete(node);
		scopeStack.pop();
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Require hooks to be declared before the tests in their scope.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

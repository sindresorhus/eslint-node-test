import {resolveImports, parseTestCall, getTestCallback} from './utils/node-test.js';

const MESSAGE_ID = 'no-duplicate-hooks';

const messages = {
	[MESSAGE_ID]: 'Duplicate `{{name}}` hook in the same scope.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Stack of scopes; each scope tracks the hook names already declared in it.
	const scopeStack = [new Set()];
	// Calls whose callback opened a scope, so we can pop on exit.
	const pushedCalls = new Set();

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed) {
			return;
		}

		let problem;
		if (parsed.kind === 'hook') {
			const scope = scopeStack.at(-1);
			if (scope.has(parsed.name)) {
				problem = {
					node,
					messageId: MESSAGE_ID,
					data: {name: parsed.name},
				};
			} else {
				scope.add(parsed.name);
			}
		} else if (parsed.kind === 'test' || parsed.kind === 'suite') {
			const callback = getTestCallback(node);
			if (callback) {
				scopeStack.push(new Set());
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
			description: 'Disallow duplicate hooks within the same scope.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

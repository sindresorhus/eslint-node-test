import {
	resolveImports,
	parseAssertionCall,
	createContextTracker,
	isAssertionCallWithSupportedContext,
} from './utils/node-test.js';

const MESSAGE_ID = 'require-throws-expectation';

const messages = {
	[MESSAGE_ID]: '`{{method}}()` accepts any thrown value. Pass an error matcher (error class, `RegExp`, validation object, or function) as the second argument.',
};

const THROWS_METHODS = new Set(['throws', 'rejects']);

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const parsed = parseAssertionCall(node, imports);
		if (!parsed || !THROWS_METHODS.has(parsed.method) || !isAssertionCallWithSupportedContext(node, tracker)) {
			return;
		}

		// Only the single-argument form lacks a matcher. A spread could expand to one.
		if (node.arguments.length !== 1 || node.arguments[0].type === 'SpreadElement') {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
			data: {method: parsed.method},
		};
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Require an error matcher for `assert.throws()`/`assert.rejects()`.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

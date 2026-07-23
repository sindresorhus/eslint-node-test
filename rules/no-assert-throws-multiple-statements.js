import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import isFunction from './ast/is-function.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-assert-throws-multiple-statements';

const messages = {
	[MESSAGE_ID]: 'Keep the `{{method}}()` callback to one statement so unrelated setup errors cannot satisfy the assertion.',
};

const TARGET_METHODS = new Set(['throws', 'rejects']);

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const parsed = parseSupportedAssertionCall(node, imports, tracker);
		if (!parsed || !TARGET_METHODS.has(parsed.method)) {
			return;
		}

		const [firstArgument] = node.arguments;
		if (!firstArgument || firstArgument.type === 'SpreadElement') {
			return;
		}

		const callback = unwrapTypeScriptExpression(firstArgument);
		if (!isFunction(callback) || callback.body.type !== 'BlockStatement' || callback.body.body.length <= 1) {
			return;
		}

		return {
			node: callback.body,
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
			description: 'Disallow multiple statements in `assert.throws()`/`assert.rejects()` callbacks.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

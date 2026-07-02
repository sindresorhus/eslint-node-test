import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getEffectiveArity,
} from './utils/node-test.js';

const MESSAGE_ID = 'no-done-callback';

const messages = {
	[MESSAGE_ID]: 'Use `async`/`await` or return a Promise instead of the `{{name}}` callback parameter.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		// Suite (`describe`/`suite`) callbacks receive a `SuiteContext`, never a `done` callback.
		if (parsed?.kind !== 'test' && parsed?.kind !== 'hook') {
			return;
		}

		const callback = getTestCallback(node);
		// A declared second parameter is the `done` callback `node:test` passes based on arity.
		if (!callback || getEffectiveArity(callback.params) < 2) {
			return;
		}

		const parameter = callback.params[1];
		return {
			node: parameter,
			messageId: MESSAGE_ID,
			data: {name: parameter.type === 'Identifier' ? parameter.name : 'done'},
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow callback (`done`) parameters in tests and hooks.',
			recommended: false,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

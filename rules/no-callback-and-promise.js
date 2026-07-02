import {
	resolveImports,
	parseTestCall,
	getTestCallback,
	getEffectiveArity,
} from './utils/node-test.js';

const MESSAGE_ID = 'no-callback-and-promise';

const messages = {
	[MESSAGE_ID]: 'A {{kind}} cannot use both a callback parameter and a Promise; this `async` function also declares a callback.',
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
		if (!callback?.async || getEffectiveArity(callback.params) < 2) {
			return;
		}

		return {
			node: callback.params[1],
			messageId: MESSAGE_ID,
			data: {kind: parsed.kind === 'hook' ? 'hook' : 'test'},
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow a test or hook from using both a callback and a Promise.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

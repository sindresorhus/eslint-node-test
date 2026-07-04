import {
	resolveImports,
	parseTestCall,
	parseAssertionCall,
	createContextTracker,
	isAssertionCallWithSupportedContext,
} from './utils/node-test.js';

const MESSAGE_ID = 'max-assertions';

const messages = {
	[MESSAGE_ID]: 'Too many assertions ({{count}}). Maximum allowed is {{max}}.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {max} = context.options[0];
	const tracker = createContextTracker(imports);

	// One frame per enclosing test/subtest; assertions count toward the innermost.
	const frames = [];

	context.on('CallExpression', node => {
		const isTest = parseTestCall(node, imports)?.kind === 'test' || tracker.isSubtestCall(node);
		tracker.update(node);

		if (isTest) {
			frames.push({node, count: 0});
			return;
		}

		if (frames.length > 0 && parseAssertionCall(node, imports) && isAssertionCallWithSupportedContext(node, tracker)) {
			frames.at(-1).count += 1;
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);

		if (frames.at(-1)?.node !== node) {
			return;
		}

		const {count} = frames.pop();
		if (count > max) {
			return {
				node,
				messageId: MESSAGE_ID,
				data: {count, max},
			};
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Enforce a maximum number of assertions in a test.',
			recommended: false,
		},
		schema: [
			{
				type: 'object',
				properties: {
					max: {
						type: 'integer',
						minimum: 1,
						description: 'The maximum number of assertions allowed in a test.',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{max: 5}],
		messages,
		languages: ['js/js'],
	},
};

export default config;

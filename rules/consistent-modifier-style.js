import {
	resolveImports,
	parseTestCall,
	getTestOptions,
	findOptionsProperty,
	MODIFIERS,
} from './utils/node-test.js';

const MESSAGE_ID_PREFER_CHAINED = 'consistent-modifier-style/prefer-chained';
const MESSAGE_ID_PREFER_OPTIONS = 'consistent-modifier-style/prefer-options';

const messages = {
	[MESSAGE_ID_PREFER_CHAINED]: 'Use the chained modifier `.{{modifier}}` instead of the `{{modifier}}` option.',
	[MESSAGE_ID_PREFER_OPTIONS]: 'Use the `{{modifier}}` option instead of the chained `.{{modifier}}`.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {style} = context.options[0];

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed) {
			return;
		}

		// Only tests and suites have `.only`/`.skip`/`.todo`; hooks have no chained modifier form.
		if (parsed.kind === 'hook') {
			return;
		}

		if (style === 'chained') {
			// Flag modifiers expressed through the options object, but only `modifier: true`. A string
			// reason (`{skip: 'why'}`), `false`, or a dynamic value has no equivalent chained form.
			const options = getTestOptions(node);
			const problems = [];
			for (const modifier of MODIFIERS) {
				const property = findOptionsProperty(options, modifier);
				if (property?.value.type === 'Literal' && property.value.value === true) {
					problems.push({
						node: property,
						messageId: MESSAGE_ID_PREFER_CHAINED,
						data: {modifier},
					});
				}
			}

			return problems;
		}

		// `style === 'options'` — flag chained modifiers. `parsed.modifiers` includes any member
		// after the test binding, so restrict to the real modifiers (`only`/`skip`/`todo`).
		return parsed.modifiers
			.filter(modifier => MODIFIERS.has(modifier.name))
			.map(modifier => ({
				node: modifier,
				messageId: MESSAGE_ID_PREFER_OPTIONS,
				data: {modifier: modifier.name},
			}));
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Enforce a consistent style for test modifiers.',
			recommended: false,
		},
		schema: [
			{
				type: 'object',
				properties: {
					style: {
						enum: ['chained', 'options'],
						description: 'Whether modifiers should be chained (`test.skip()`) or passed as options (`{skip: true}`).',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{style: 'chained'}],
		messages,
		languages: ['js/js'],
	},
};

export default config;

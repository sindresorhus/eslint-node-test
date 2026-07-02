import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	getTestOptions,
	findOptionsProperty,
} from './utils/node-test.js';

const MESSAGE_ID_OPTION = 'no-skip-without-reason/option';
const MESSAGE_ID_CALL = 'no-skip-without-reason/call';

const messages = {
	[MESSAGE_ID_OPTION]: 'Give `{{modifier}}` a reason string instead of `true` explaining why.',
	[MESSAGE_ID_CALL]: 'Pass a reason message to `{{context}}.{{modifier}}()`.',
};

const REASON_MODIFIERS = new Set(['skip', 'todo']);

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		const problems = [];

		// Options form: `{skip: true}` / `{todo: true}` on a test/suite/hook.
		if (parseTestCall(node, imports)) {
			const options = getTestOptions(node);
			for (const modifier of REASON_MODIFIERS) {
				const property = findOptionsProperty(options, modifier);
				if (property?.value.type === 'Literal' && property.value.value === true) {
					problems.push({
						node: property,
						messageId: MESSAGE_ID_OPTION,
						data: {modifier},
					});
				}
			}
		}

		// Context method form: `t.skip()` / `t.todo()` with no reason message.
		const {callee} = node;
		if (
			node.arguments.length === 0
			&& callee.type === 'MemberExpression'
			&& !callee.computed
			&& callee.property.type === 'Identifier'
			&& REASON_MODIFIERS.has(callee.property.name)
			&& callee.object.type === 'Identifier'
			&& tracker.isContextName(callee.object.name)
		) {
			problems.push({
				node,
				messageId: MESSAGE_ID_CALL,
				data: {context: callee.object.name, modifier: callee.property.name},
			});
		}

		tracker.update(node);
		return problems;
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Require a reason when skipping or marking a test as todo.',
			recommended: false,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

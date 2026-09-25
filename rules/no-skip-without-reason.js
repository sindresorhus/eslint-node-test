import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	getTestOptions,
	findOptionsProperty,
	isGetTestContextCall,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

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

	// Hook callbacks receive a test context too, so `t.skip()` / `t.todo()` must be tracked there as well.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		const problems = [];

		// Options form: `{skip: true}` / `{todo: true}` on a test/suite/hook, including a subtest.
		if (parseTestCall(node, imports) || tracker.isSubtestCall(node)) {
			const options = getTestOptions(node);
			for (const modifier of REASON_MODIFIERS) {
				const property = findOptionsProperty(options, modifier);
				const value = property && unwrapTypeScriptExpression(property.value);
				if (value?.type === 'Literal' && value.value === true) {
					problems.push({
						node: property,
						messageId: MESSAGE_ID_OPTION,
						data: {modifier},
					});
				}
			}
		}

		// Context method form: `t.skip()` / `t.todo()` with no reason message. The receiver is a
		// tracked context parameter or a `getTestContext()` call, behind any TypeScript wrapper.
		const callee = unwrapTypeScriptExpression(node.callee);
		if (node.arguments.length === 0 && callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier' && REASON_MODIFIERS.has(callee.property.name)) {
			const receiver = unwrapTypeScriptExpression(callee.object);
			if (receiver.type === 'Identifier' && tracker.isContextIdentifier(receiver)) {
				problems.push({
					node,
					messageId: MESSAGE_ID_CALL,
					data: {context: receiver.name, modifier: callee.property.name},
				});
			} else if (isGetTestContextCall(receiver, imports)) {
				problems.push({
					node,
					messageId: MESSAGE_ID_CALL,
					data: {context: 'getTestContext()', modifier: callee.property.name},
				});
			}
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

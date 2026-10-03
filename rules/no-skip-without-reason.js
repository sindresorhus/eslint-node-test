import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	getTestOptions,
	findOptionsProperty,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {isMemberExpression} from './ast/index.js';

const MESSAGE_ID_OPTION = 'no-skip-without-reason/option';
const MESSAGE_ID_CALL = 'no-skip-without-reason/call';

const messages = {
	[MESSAGE_ID_OPTION]: 'Give `{{modifier}}` a reason string instead of `true` explaining why.',
	[MESSAGE_ID_CALL]: 'Pass a reason message to `{{context}}.{{modifier}}()`.',
};

const REASON_MODIFIERS = ['skip', 'todo'];

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

		// Options form: `{skip: true}` / `{todo: true}` on a test/suite, including a subtest. A hook has no such option, so `skip`/`todo` in its options belong to `no-unknown-test-options`.
		const parsed = parseTestCall(node, imports);
		if ((parsed && parsed.kind !== 'hook') || tracker.isSubtestCall(node)) {
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

		// Context method form: `t.skip()` / `t.todo()` with no reason message. The receiver is a tracked context parameter or a `getTestContext()` call, behind any TypeScript wrapper.
		const callee = unwrapTypeScriptExpression(node.callee);
		if (node.arguments.length === 0 && isMemberExpression(callee, REASON_MODIFIERS)) {
			const receiver = unwrapTypeScriptExpression(callee.object);
			if (tracker.isContextReceiver(receiver)) {
				// Named as the file writes it: the context parameter, a renamed `getTestContext()` import, or `test.getTestContext()`.
				problems.push({
					node,
					messageId: MESSAGE_ID_CALL,
					data: {context: context.sourceCode.getText(receiver), modifier: callee.property.name},
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

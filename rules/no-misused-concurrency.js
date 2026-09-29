import {getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	getSubtestReceiver,
	getTestCallback,
	getTestOptions,
	findOptionsProperty,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-misused-concurrency';

const messages = {
	[MESSAGE_ID]: 'The `concurrency` option has no effect on a test without subtests. It only controls how a suite or a test\'s subtests run concurrently.',
};

/*
The `concurrency` property a call actually sets, or `undefined` when it does not set one.

`node:test` keeps its default for `null` and `undefined`, and `false` sets the same default of one, so
those three leave the option inert. Every other value is validated as a number or a boolean and kept.
This is the opposite of the `skip`/`todo` question for `false`, so it cannot share that helper.
*/
function getConcurrencyProperty(options, context) {
	const property = findOptionsProperty(options, 'concurrency');
	if (!property) {
		return undefined;
	}

	const staticValue = getStaticValue(unwrapTypeScriptExpression(property.value), context.sourceCode.getScope(property.value));
	// A value that cannot be resolved is still set: whatever it turns out to be, it has no effect on a leaf test.
	return staticValue !== null && [undefined, null, false].includes(staticValue.value)
		? undefined
		: property;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);

	// One frame per test/subtest. A frame with a `concurrency` option but no subtests is misused.
	const frames = [];

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);

		// Attribute this subtest to the frame that owns its receiver context, before it pushes its own.
		if (isSubtest) {
			const receiver = getSubtestReceiver(node);
			// `getTestContext().test(…)` names the innermost context, so it belongs to the innermost frame; a context parameter is matched by the name the tracker resolved it to.
			const ownerFrame = receiver
				? frames.findLast(frame => frame.contextName === receiver.name)
				: frames.at(-1);
			if (ownerFrame) {
				ownerFrame.hasSubtest = true;
			}
		}

		const isTest = parseTestCall(node, imports)?.kind === 'test';
		tracker.update(node);

		if (isTest || isSubtest) {
			// Only an inline callback, or a test with none, is checked. Any other callback (`test('t', options, body)`, `helpers.body`, `makeBody()`, or `{fn: body}`) is declared away from the test, or not in this file at all, so its subtests cannot be counted here and the option is left alone.
			const options = getTestOptions(node);
			const lastArgument = node.arguments.at(-1) && unwrapTypeScriptExpression(node.arguments.at(-1));
			const hasNonInlineCallback = !getTestCallback(node, imports)
				&& (lastArgument !== options || findOptionsProperty(options, 'fn') !== undefined);
			frames.push({
				node,
				contextName: tracker.current(),
				concurrencyProperty: hasNonInlineCallback ? undefined : getConcurrencyProperty(options, context),
				hasSubtest: false,
			});
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);

		if (frames.at(-1)?.node !== node) {
			return;
		}

		const frame = frames.pop();
		if (frame.concurrencyProperty && !frame.hasSubtest) {
			return {
				node: frame.concurrencyProperty,
				messageId: MESSAGE_ID,
			};
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow the `concurrency` option on a test without subtests.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

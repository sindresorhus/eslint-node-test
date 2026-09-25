import {getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	getSubtestReceiver,
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
	return staticValue === null || [undefined, null, false].includes(staticValue.value)
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
			// `getTestContext().test(…)` names the innermost context, so it belongs to the innermost
			// frame; a context parameter is matched by the name the tracker resolved it to.
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
			frames.push({
				node,
				contextName: tracker.current(),
				concurrencyProperty: getConcurrencyProperty(getTestOptions(node), context),
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

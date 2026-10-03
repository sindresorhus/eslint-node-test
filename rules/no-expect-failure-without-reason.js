import {getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	getTestOptions,
	findOptionsProperty,
	hasOnlyKnownModifiers,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-expect-failure-without-reason';

const messages = {
	[MESSAGE_ID]: 'Give `expectFailure` a reason string instead of `{{value}}` explaining why.',
};

/*
Whether `expectFailure` is off, so the rule has nothing to say: `node:test` reads `undefined` and
`false` as "no expected failure".
*/
function isExpectFailureOff(value) {
	return value === undefined || value === false;
}

/*
Whether a value carries a reason or a matcher, which is what `parseExpectFailure` accepts. It rejects
`null` outright and any object with no own enumerable keys, such as `{}`, `[]`, or a `Date`, so those
are not reasons either: they are values the runner throws on. An empty string turns the expected
failure on with no reason at all.
*/
function hasExpectFailureReason(value) {
	if (typeof value === 'string') {
		return value !== '';
	}

	if (typeof value === 'function' || value instanceof RegExp) {
		return true;
	}

	return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// A subtest (`t.test(…)`) accepts `expectFailure` too, so it is recognized through the tracker.
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);
		tracker.update(node);

		const parsed = parseTestCall(node, imports);
		if (
			(!parsed && !isSubtest)
			|| parsed?.kind === 'hook'
			|| parsed?.hasExpectedFailure
			|| (parsed && !hasOnlyKnownModifiers(parsed))
		) {
			return;
		}

		const property = findOptionsProperty(getTestOptions(node), 'expectFailure');
		const value = property && unwrapTypeScriptExpression(property.value);
		if (!value) {
			return;
		}

		const staticValue = getStaticValue(value, context.sourceCode.getScope(value));
		if (staticValue === null || isExpectFailureOff(staticValue.value) || hasExpectFailureReason(staticValue.value)) {
			return;
		}

		return {
			node: property,
			messageId: MESSAGE_ID,
			data: {value: sourceCode.getText(value)},
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Require a reason when marking a test or suite as expected to fail.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

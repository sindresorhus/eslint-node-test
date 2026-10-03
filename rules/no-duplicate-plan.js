import {findVariable} from '@eslint-community/eslint-utils';
import {
	hasOnlyKnownModifiers,
	resolveImports,
	parseTestCall,
	getTestCallback,
	getSubtestReceiver,
	isGetTestContextSubtestCall,
	hasEnabledPlanOption,
	getFirstContextParameter,
	isGetTestContextCall,
	getPlanCallReceiver,
} from './utils/node-test.js';
import {isSkippedTestCall, isInsideSkippedCallback} from './shared/skipped-test.js';

const MESSAGE_ID_DUPLICATE_CALL = 'no-duplicate-plan/duplicate-call';
const MESSAGE_ID_PLAN_OPTION = 'no-duplicate-plan/plan-option';

const messages = {
	[MESSAGE_ID_DUPLICATE_CALL]: 'Do not call `{{context}}.plan()` more than once in the same test.',
	[MESSAGE_ID_PLAN_OPTION]: 'Do not call `{{context}}.plan()` when this test already has a `plan` option.',
};

function getIdentifierVariable(sourceCode, identifier) {
	return findVariable(sourceCode.getScope(identifier), identifier);
}

function isTestCall(parsed) {
	return parsed?.kind === 'test' && hasOnlyKnownModifiers(parsed);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const {sourceCode} = context;
	const frames = [];
	const skippedCallbacks = new WeakSet();

	const isSubtestCall = node => {
		const receiver = getSubtestReceiver(node);
		if (receiver === undefined) {
			// A `getTestContext().test(…)` subtest names the innermost frame's context, the same one the parent's `t` parameter would.
			return frames.length > 0 && isGetTestContextSubtestCall(node, imports);
		}

		const receiverVariable = getIdentifierVariable(sourceCode, receiver);
		return receiverVariable !== undefined && frames.some(frame => frame.contextVariable === receiverVariable);
	};

	// The context a `<context>.plan(…)` receiver names: the variable of an identifier, or for a context `getTestContext()` returned, the innermost frame's context, which the test callback's parameter names too, whether or not that test declared a parameter for it.
	const getPlanContextKey = receiver => {
		if (receiver?.type === 'Identifier') {
			return getIdentifierVariable(sourceCode, receiver);
		}

		return receiver !== undefined && isGetTestContextCall(receiver, imports) ? frames.at(-1)?.contextKey : undefined;
	};

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		const isImportedTestCall = isTestCall(parsed);
		const isTest = isImportedTestCall || isSubtestCall(node);

		if (isTest) {
			if (isSkippedTestCall(node, parsed, context)) {
				const callback = getTestCallback(node);
				if (callback) {
					skippedCallbacks.add(callback);
				}

				return;
			}

			// A test without a context parameter still has a context, reachable through `getTestContext()`, so the frame is pushed either way.
			const parameter = getFirstContextParameter(getTestCallback(node)?.params);
			const hasPlanOption = hasEnabledPlanOption(node, context);
			const frame = {
				node,
				contextName: parameter?.name,
				contextVariable: parameter ? getIdentifierVariable(sourceCode, parameter) : undefined,
				hasPlan: hasPlanOption,
				hasPlanOption,
			};
			// A test that declares no context parameter still has one, reachable through `getTestContext()`, so the frame stands in as its own key.
			frame.contextKey = frame.contextVariable ?? frame;
			frames.push(frame);
			return;
		}

		const receiver = getPlanCallReceiver(node);
		const contextKey = getPlanContextKey(receiver);
		if (contextKey === undefined || isInsideSkippedCallback(node, skippedCallbacks)) {
			return;
		}

		for (let index = frames.length - 1; index >= 0; index -= 1) {
			const frame = frames[index];
			if (frame.contextKey !== contextKey) {
				continue;
			}

			if (frame.hasPlan) {
				// A test with no context parameter is named by the `getTestContext()` call as the file writes it, whether through a renamed import or a test binding (`test.getTestContext()`).
				return {
					node,
					messageId: frame.hasPlanOption ? MESSAGE_ID_PLAN_OPTION : MESSAGE_ID_DUPLICATE_CALL,
					data: {
						context: frame.contextName ?? sourceCode.getText(receiver),
					},
				};
			}

			frame.hasPlan = true;
			break;
		}
	});

	context.onExit('CallExpression', node => {
		if (frames.at(-1)?.node === node) {
			frames.pop();
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow setting a test plan more than once in the same test.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

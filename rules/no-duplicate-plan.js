import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import {
	MODIFIERS,
	resolveImports,
	parseTestCall,
	getTestCallback,
	getSubtestReceiver,
	getTestOptions,
	findOptionsProperty,
	hasEnabledPlanOption,
	getContextParameterIdentifier,
	isGetTestContextCall,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {isSkippedTestCall, isInsideSkippedCallback} from './shared/skipped-test.js';

const MESSAGE_ID_DUPLICATE_CALL = 'no-duplicate-plan/duplicate-call';
const MESSAGE_ID_PLAN_OPTION = 'no-duplicate-plan/plan-option';

const messages = {
	[MESSAGE_ID_DUPLICATE_CALL]: 'Do not call `{{context}}.plan()` more than once in the same test.',
	[MESSAGE_ID_PLAN_OPTION]: 'Do not call `{{context}}.plan()` when this test already has a `plan` option.',
};

function getPlanContextIdentifier(node) {
	// A TypeScript wrapper on the callee (`t.plan!(…)`, `(t.plan as any)(…)`) must not hide the call.
	const callee = unwrapTypeScriptExpression(node.callee);
	if (
		node.optional !== true
		&& callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.optional !== true
		&& callee.property.type === 'Identifier'
		&& callee.property.name === 'plan'
	) {
		const object = unwrapTypeScriptExpression(callee.object);
		return object.type === 'Identifier' ? object : undefined;
	}

	return undefined;
}

/*
Whether the call is `<context>.plan(…)` on a context `getTestContext()` returned, which names the
same context the test callback's parameter does.
*/
function isGetTestContextPlanCall(node, imports) {
	const callee = unwrapTypeScriptExpression(node.callee);
	return node.optional !== true
		&& callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.optional !== true
		&& callee.property.type === 'Identifier'
		&& callee.property.name === 'plan'
		&& isGetTestContextCall(unwrapTypeScriptExpression(callee.object), imports);
}

function getIdentifierVariable(sourceCode, identifier) {
	return findVariable(sourceCode.getScope(identifier), identifier);
}

function isTestCall(parsed) {
	return parsed !== undefined && parsed.kind === 'test' && parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name));
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
			return false;
		}

		const receiverVariable = getIdentifierVariable(sourceCode, receiver);
		return receiverVariable !== undefined && frames.some(frame => frame.contextVariable === receiverVariable);
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

			// A test without a context parameter still has a context, reachable through
			// `getTestContext()`, so the frame is pushed either way.
			const parameter = getContextParameterIdentifier(getTestCallback(node)?.params[0]);
			const hasPlanOption = hasEnabledPlanOption(node, context);
			const frame = {
				node,
				contextName: parameter?.name,
				contextVariable: parameter ? getIdentifierVariable(sourceCode, parameter) : undefined,
				hasPlan: hasPlanOption,
				hasPlanOption,
			};
			// A test that declares no context parameter still has one, reachable through
			// `getTestContext()`, so the frame stands in as its own key.
			frame.contextKey = frame.contextVariable ?? frame;
			frames.push(frame);
			return;
		}

		const contextIdentifier = getPlanContextIdentifier(node);
		const isContextCall = isGetTestContextPlanCall(node, imports);
		if (contextIdentifier === undefined && !isContextCall) {
			return;
		}

		if (isInsideSkippedCallback(node, skippedCallbacks)) {
			return;
		}

		// A `getTestContext()` call names the innermost frame's context, whether or not that test
		// declared a parameter for it.
		const contextKey = contextIdentifier
			? getIdentifierVariable(sourceCode, contextIdentifier)
			: frames.at(-1)?.contextKey;
		if (contextKey === undefined) {
			return;
		}

		for (let index = frames.length - 1; index >= 0; index -= 1) {
			const frame = frames[index];
			if (frame.contextKey !== contextKey) {
				continue;
			}

			if (frame.hasPlan) {
				return {
					node,
					messageId: frame.hasPlanOption ? MESSAGE_ID_PLAN_OPTION : MESSAGE_ID_DUPLICATE_CALL,
					data: {context: frame.contextName ?? 'getTestContext()'},
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

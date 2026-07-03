import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import {
	MODIFIERS,
	resolveImports,
	parseTestCall,
	getTestCallback,
	getSubtestReceiver,
	getTestOptions,
	findOptionsProperty,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID_DUPLICATE_CALL = 'no-duplicate-plan/duplicate-call';
const MESSAGE_ID_PLAN_OPTION = 'no-duplicate-plan/plan-option';
const MAX_PLAN_COUNT = 4_294_967_295;

const messages = {
	[MESSAGE_ID_DUPLICATE_CALL]: 'Do not call `{{context}}.plan()` more than once in the same test.',
	[MESSAGE_ID_PLAN_OPTION]: 'Do not call `{{context}}.plan()` when this test already has a `plan` option.',
};

function getPlanContextIdentifier(node) {
	const {callee} = node;
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

function getIdentifierVariable(sourceCode, identifier) {
	return findVariable(sourceCode.getScope(identifier), identifier);
}

function isTestCall(parsed) {
	return parsed !== undefined && parsed.kind === 'test' && parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name));
}

function hasSkipModifier(node) {
	node = unwrapTypeScriptExpression(node);

	while (node.type === 'MemberExpression') {
		if (
			!node.computed
			&& node.property.type === 'Identifier'
			&& node.property.name === 'skip'
		) {
			return true;
		}

		node = unwrapTypeScriptExpression(node.object);
	}

	return false;
}

function hasEnabledSkipOption(node, sourceCode) {
	const property = findOptionsProperty(getTestOptions(node), 'skip');
	if (property === undefined) {
		return false;
	}

	const staticValue = getStaticValue(property.value, sourceCode.getScope(property.value));
	return staticValue !== null && Boolean(staticValue.value);
}

function isSkippedTestCall(node, sourceCode) {
	return hasSkipModifier(node.callee) || hasEnabledSkipOption(node, sourceCode);
}

function hasEnabledPlanOption(node, sourceCode) {
	const property = findOptionsProperty(getTestOptions(node), 'plan');
	if (property === undefined) {
		return false;
	}

	const staticValue = getStaticValue(property.value, sourceCode.getScope(property.value));
	return typeof staticValue?.value === 'number' && Number.isSafeInteger(staticValue.value) && staticValue.value > 0 && staticValue.value <= MAX_PLAN_COUNT;
}

function isInsideSkippedCallback(node, skippedCallbacks) {
	let current = node;
	while (current) {
		if (skippedCallbacks.has(current)) {
			return true;
		}

		current = current.parent;
	}

	return false;
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
			if (isSkippedTestCall(node, sourceCode)) {
				const callback = getTestCallback(node);
				if (callback) {
					skippedCallbacks.add(callback);
				}

				return;
			}

			const parameter = getTestCallback(node)?.params[0];
			if (parameter?.type !== 'Identifier') {
				return;
			}

			const hasPlanOption = hasEnabledPlanOption(node, sourceCode);
			frames.push({
				node,
				contextName: parameter.name,
				contextVariable: getIdentifierVariable(sourceCode, parameter),
				hasPlan: hasPlanOption,
				hasPlanOption,
			});
			return;
		}

		const contextIdentifier = getPlanContextIdentifier(node);
		if (contextIdentifier === undefined) {
			return;
		}

		if (isInsideSkippedCallback(node, skippedCallbacks)) {
			return;
		}

		const contextVariable = getIdentifierVariable(sourceCode, contextIdentifier);
		if (contextVariable === undefined) {
			return;
		}

		for (let index = frames.length - 1; index >= 0; index -= 1) {
			const frame = frames[index];
			if (frame.contextVariable !== contextVariable) {
				continue;
			}

			if (frame.hasPlan) {
				return {
					node,
					messageId: frame.hasPlanOption ? MESSAGE_ID_PLAN_OPTION : MESSAGE_ID_DUPLICATE_CALL,
					data: {context: frame.contextName},
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

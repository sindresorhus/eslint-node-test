import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	MODIFIERS,
	getCalleeChain,
	getContextParameterIdentifier,
	getTestCallback,
	getTestOptions,
	findOptionsProperty,
} from './utils/node-test.js';
import {getEnclosingFunction} from './utils/index.js';

const MESSAGE_ID = 'no-misused-context-hook';
const CONTEXT_HOOKS = new Set(['beforeEach', 'afterEach']);

const messages = {
	[MESSAGE_ID]: '`{{name}}()` has no effect on a test without runnable subtests. It only runs around the test\'s subtests.',
};

function getContextHookReceiver(callExpression) {
	const chain = getCalleeChain(callExpression.callee);
	if (
		!chain
		|| chain.members.length !== 1
		|| !CONTEXT_HOOKS.has(chain.members[0].name)
	) {
		return undefined;
	}

	return chain.root;
}

function getDirectSubtestReceiver(callExpression) {
	const chain = getCalleeChain(callExpression.callee);
	if (
		!chain
		|| chain.members.length !== 1
		|| chain.members[0].name !== 'test'
	) {
		return undefined;
	}

	return chain.root;
}

function isStaticallySkipped(callExpression, sourceCode) {
	const skipProperty = findOptionsProperty(getTestOptions(callExpression), 'skip');
	if (skipProperty === undefined) {
		return false;
	}

	const staticValue = getStaticValue(skipProperty.value, sourceCode.getScope(skipProperty.value));
	return staticValue !== null && Boolean(staticValue.value);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const frames = [];
	const skippedCallbacks = new WeakSet();

	const getContextVariable = callback => {
		const parameter = getContextParameterIdentifier(callback.params[0]);
		return parameter
			? findVariable(sourceCode.getScope(parameter), parameter)
			: undefined;
	};

	const getFrame = receiver => {
		if (receiver?.type !== 'Identifier') {
			return undefined;
		}

		const variable = findVariable(sourceCode.getScope(receiver), receiver);
		if (variable === undefined) {
			return undefined;
		}

		return frames.findLast(frame => frame.contextVariable === variable);
	};

	const isInsideSkippedCallback = node => {
		for (let current = node.parent; current; current = current.parent) {
			if (skippedCallbacks.has(current)) {
				return true;
			}
		}

		return false;
	};

	const getRunnableSubtestFrame = (node, enclosingFunction) => {
		const receiver = getDirectSubtestReceiver(node);
		const frame = getFrame(receiver);
		if (
			!frame
			|| enclosingFunction !== frame.callback
			|| isInsideSkippedCallback(node)
			|| isStaticallySkipped(node, sourceCode)
		) {
			return undefined;
		}

		return frame;
	};

	const isRunnableTest = (node, parsed, parentFrame) => parsed?.kind === 'test'
		&& parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name))
		&& (frames.length === 0 || parentFrame !== undefined)
		&& !isInsideSkippedCallback(node)
		&& parsed.modifiers.every(modifier => modifier.name !== 'skip')
		&& !isStaticallySkipped(node, sourceCode);

	context.on('CallExpression', node => {
		const enclosingFunction = getEnclosingFunction(node);
		const runnableSubtestFrame = getRunnableSubtestFrame(node, enclosingFunction);
		if (runnableSubtestFrame) {
			runnableSubtestFrame.hasSubtest = true;
		}

		const hookReceiver = getContextHookReceiver(node);
		const frame = getFrame(hookReceiver);
		if (frame && enclosingFunction === frame.callback) {
			frame.hooks.push(node);
		}

		const parsed = parseTestCall(node, imports);
		const isSkippedCallback = (parsed?.kind === 'test' || parsed?.kind === 'suite')
			&& parsed.modifiers.every(modifier => MODIFIERS.has(modifier.name))
			&& (
				parsed.modifiers.some(modifier => modifier.name === 'skip')
				|| isStaticallySkipped(node, sourceCode)
			);
		if (isSkippedCallback) {
			const callback = getTestCallback(node);
			if (callback) {
				skippedCallbacks.add(callback);
			}
		}

		const parentTestFrame = frames.findLast(frame => frame.callback === enclosingFunction);
		const runnableTest = isRunnableTest(node, parsed, parentTestFrame);
		if (runnableTest && parentTestFrame) {
			parentTestFrame.hasSubtest = true;
		}

		if (!runnableTest && !runnableSubtestFrame) {
			return;
		}

		const callback = getTestCallback(node);
		if (!callback) {
			return;
		}

		frames.push({
			node,
			callback,
			contextVariable: getContextVariable(callback),
			hasSubtest: false,
			hooks: [],
		});
	});

	context.onExit('CallExpression', function * (node) {
		if (frames.at(-1)?.node !== node) {
			return;
		}

		const frame = frames.pop();
		if (frame.hasSubtest) {
			return;
		}

		for (const hook of frame.hooks) {
			const {members} = getCalleeChain(hook.callee);
			yield {
				node: hook,
				messageId: MESSAGE_ID,
				data: {name: members[0].name},
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
			description: 'Disallow context hooks without runnable subtests.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

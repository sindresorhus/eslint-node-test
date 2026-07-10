import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	createContextTracker,
	getCalleeChain,
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

	const tracker = createContextTracker(imports);
	const frames = [];

	const getContextVariable = callback => {
		const parameter = callback.params[0];
		return parameter?.type === 'Identifier'
			? findVariable(sourceCode.getScope(parameter), parameter)
			: undefined;
	};

	const getFrame = receiver => {
		const variable = findVariable(sourceCode.getScope(receiver), receiver);
		return frames.findLast(frame => frame.contextVariable === variable);
	};

	context.on('CallExpression', node => {
		const subtestReceiver = getDirectSubtestReceiver(node);
		const isSubtest = tracker.isContextIdentifier(subtestReceiver);
		const frame = isSubtest ? getFrame(subtestReceiver) : undefined;
		const isRunnableSubtest = frame !== undefined
			&& getEnclosingFunction(node) === frame.callback
			&& !isStaticallySkipped(node, sourceCode);
		if (isRunnableSubtest) {
			frame.hasSubtest = true;
		}

		const hookReceiver = getContextHookReceiver(node);
		if (tracker.isContextIdentifier(hookReceiver)) {
			const frame = getFrame(hookReceiver);
			if (frame && getEnclosingFunction(node) === frame.callback) {
				frame.hooks.push(node);
			}
		}

		const isTest = parseTestCall(node, imports)?.kind === 'test';
		if (isTest || isRunnableSubtest) {
			tracker.update(node);
		}

		if (isTest || isRunnableSubtest) {
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
		}
	});

	context.onExit('CallExpression', function * (node) {
		tracker.leave(node);

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

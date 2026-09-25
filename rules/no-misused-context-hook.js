import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	MODIFIERS,
	getCalleeChain,
	getSubtestReceiver,
	getContextParameterIdentifier,
	getTestCallback,
	getTestOptions,
	findOptionsProperty,
} from './utils/node-test.js';
import {getEnclosingFunction} from './utils/index.js';
import isFunction from './ast/is-function.js';

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
	const receiver = getSubtestReceiver(callExpression);
	if (receiver === undefined) {
		return undefined;
	}

	// `t.test.only`/`t.test.todo` are still runnable, so their hooks are meaningful; `t.test.skip`
	// is not runnable and is treated the same as having no subtest (the hook is reported).
	const {members} = getCalleeChain(callExpression.callee);
	return members.some(member => member.name === 'skip') ? undefined : receiver;
}

function isStaticallySkipped(callExpression, sourceCode) {
	const skipProperty = findOptionsProperty(getTestOptions(callExpression), 'skip');
	if (skipProperty === undefined) {
		return false;
	}

	const staticValue = getStaticValue(skipProperty.value, sourceCode.getScope(skipProperty.value));
	return staticValue !== null && Boolean(staticValue.value);
}

const ITERATION_METHODS = new Set(['every', 'filter', 'find', 'flatMap', 'forEach', 'map', 'some']);

/**
Whether an iteration callback is invoked by a statement that is itself part of `ancestor`.

A subtest written inside a `xs.map(…)` callback still runs, because the map is part of the test
body, so the enclosing function of the subtest is the iteration callback rather than the test
callback. This walks out of those callbacks; any other function (a declared helper) is a real
scope boundary and ends the walk.

Only the first argument is the callback. A second argument is `thisArg`, which the array methods
pass to the callback rather than calling itself, so a subtest written there never runs.
*/
function isInvokedIterationCallback(node, parent) {
	return parent?.type === 'CallExpression'
		&& parent.callee.type === 'MemberExpression'
		&& !parent.callee.computed
		&& parent.callee.property.type === 'Identifier'
		&& ITERATION_METHODS.has(parent.callee.property.name)
		&& parent.arguments[0] === node;
}

function isWithinIterationCallbackOf(node, ancestor) {
	let current = node;

	while (current && current !== ancestor) {
		const {parent} = current;
		if (
			isFunction(current)
			&& (
				isInvokedIterationCallback(current, parent)
				|| parent?.type === 'ForOfStatement'
				|| parent?.type === 'ForStatement'
				|| parent?.type === 'WhileStatement'
				|| parent?.type === 'DoWhileStatement'
			)
		) {
			current = parent;
			continue;
		}

		if (isFunction(current)) {
			return false;
		}

		current = parent;
	}

	return current === ancestor;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const frames = [];
	const skippedCallbacks = new Set();

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
		// Walking to the root is the expensive part of visiting a call, and most files skip nothing.
		if (skippedCallbacks.size === 0) {
			return false;
		}

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
			|| !isWithinIterationCallbackOf(node, frame.callback)
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

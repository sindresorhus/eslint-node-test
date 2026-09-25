import {findVariable, getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	MODIFIERS,
	getCalleeChain,
	getSubtestReceiver,
	getFirstContextParameter,
	getTestCallback,
	getTestOptions,
	findOptionsProperty,
	isGetTestContextCall,
} from './utils/node-test.js';
import {getEnclosingFunction} from './utils/index.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import isFunction from './ast/is-function.js';

const MESSAGE_ID = 'no-misused-context-hook';
const CONTEXT_HOOKS = new Set(['beforeEach', 'afterEach']);

const messages = {
	[MESSAGE_ID]: '`{{name}}()` has no effect on a test without runnable subtests. It only runs around the test\'s subtests.',
};

/**
The receiver of a `<context>.beforeEach(…)`-style hook, or `undefined` when the call is not one. The
receiver is a context parameter or a `getTestContext()` call, so it is returned as a node for
`getFrame` to resolve.
*/
function getContextHookReceiver(callExpression, imports) {
	const callee = unwrapTypeScriptExpression(callExpression.callee);
	if (
		callee?.type !== 'MemberExpression'
		|| callee.computed
		|| callee.property.type !== 'Identifier'
		|| !CONTEXT_HOOKS.has(callee.property.name)
	) {
		return undefined;
	}

	const receiver = unwrapTypeScriptExpression(callee.object);
	if (receiver.type === 'Identifier') {
		return receiver;
	}

	return isGetTestContextCall(receiver, imports) ? GET_TEST_CONTEXT : undefined;
}

function getDirectSubtestReceiver(callExpression, imports) {
	const receiver = getSubtestReceiver(callExpression);
	if (receiver === undefined) {
		// `getTestContext().test(…)` creates the same subtest, with no identifier to match on.
		return isGetTestContextSubtestCall(callExpression, imports) ? GET_TEST_CONTEXT : undefined;
	}

	// `t.test` is a plain function with no `skip`, `only` or `todo` method, so any chained modifier
	// is a `TypeError` at runtime and registers nothing. Such a call is treated the same as having no
	// runnable subtest, so the hook is reported.
	const {members = []} = getCalleeChain(callExpression.callee) ?? {};
	return members.length > 1 ? undefined : receiver;
}

function isStaticallySkipped(callExpression, sourceCode) {
	// `node:test` skips for any value that is neither `undefined` nor `false`, so `{skip: 0}`,
	// `{skip: ''}` and `{skip: null}` all leave the child unrunnable, which is what this decides.
	const skipProperty = findOptionsProperty(getTestOptions(callExpression), 'skip');
	if (skipProperty === undefined) {
		return false;
	}

	const staticValue = getStaticValue(skipProperty.value, sourceCode.getScope(skipProperty.value));
	return staticValue !== null && staticValue.value !== undefined && staticValue.value !== false;
}

// Array methods that call a predicate over their elements, so a subtest registered in one of those
// callbacks still runs and the hook around it still applies.
const ITERATION_METHODS = new Set(['every', 'filter', 'find', 'findIndex', 'findLast', 'findLastIndex', 'flatMap', 'forEach', 'map', 'reduce', 'some', 'sort']);

// The argument slot a method runs its callback from, for the two that do not use the first. Only
// `Array.from(items, fn)` is here: `Array.of(…)` takes no callback at all, it makes an array of its
// arguments.
const CALLBACK_ARGUMENT_INDEX = new Map([['from', 1]]);

/** Stands in for a `getTestContext()` receiver, which has no identifier to resolve. */
const GET_TEST_CONTEXT = Symbol('getTestContext receiver');

/**
Whether the call is a subtest created through `getTestContext().test(…)`.
*/
function isGetTestContextSubtestCall(callExpression, imports) {
	const callee = unwrapTypeScriptExpression(callExpression.callee);
	return callee?.type === 'MemberExpression'
		&& !callee.computed
		&& callee.property.type === 'Identifier'
		&& callee.property.name === 'test'
		&& isGetTestContextCall(unwrapTypeScriptExpression(callee.object), imports);
}

/**
Whether an iteration callback is invoked by a statement that is itself part of `ancestor`.

A subtest written inside a `xs.map(…)` callback still runs, because the map is part of the test
body, so the enclosing function of the subtest is the iteration callback rather than the test
callback. This walks out of those callbacks; any other function (a declared helper) is a real
scope boundary and ends the walk.

For the array methods only the first argument is the callback. A second argument is `thisArg`,
which they pass to the callback rather than calling itself, so a subtest written there never runs.
`Array.from(items, fn)` is the one that runs its second argument, once per item.
*/
function isInvokedIterationCallback(node, parent) {
	if (
		parent?.type !== 'CallExpression'
		|| parent.callee.type !== 'MemberExpression'
		|| parent.callee.computed
		|| parent.callee.property.type !== 'Identifier'
	) {
		return false;
	}

	const method = parent.callee.property.name;
	if (!ITERATION_METHODS.has(method) && !CALLBACK_ARGUMENT_INDEX.has(method)) {
		return false;
	}

	return parent.arguments[CALLBACK_ARGUMENT_INDEX.get(method) ?? 0] === node;
}

/*
A suite callback runs while the file is being collected, so a subtest written in one is registered
before the test body finishes and the test's hooks really do run around it.
*/
function isSuiteCallback(node, parent, imports) {
	return parent?.type === 'CallExpression'
		&& parseTestCall(parent, imports)?.kind === 'suite'
		&& getTestCallback(parent, imports) === node;
}

/*
A function that is called where it is written — an immediately invoked function expression, with or
without `new` — runs as part of the enclosing statement, so a subtest inside it is a subtest of the
test. Only a function that is merely passed somewhere else is a real scope boundary.
*/
function isInvokedImmediately(node, parent) {
	return (parent?.type === 'CallExpression' || parent?.type === 'NewExpression') && parent.callee === node;
}

function isWithinIterationCallbackOf(node, ancestor, imports) {
	let current = node;

	while (current && current !== ancestor) {
		const {parent} = current;
		if (
			isFunction(current)
			&& (
				isInvokedIterationCallback(current, parent)
				|| isInvokedImmediately(current, parent)
				|| isSuiteCallback(current, parent, imports)
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
		const parameter = getFirstContextParameter(callback.params);
		return parameter
			? findVariable(sourceCode.getScope(parameter), parameter)
			: undefined;
	};

	const getFrame = receiver => {
		// `getTestContext()` returns the context of the innermost frame.
		if (receiver === GET_TEST_CONTEXT) {
			return frames.at(-1);
		}

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
		const receiver = getDirectSubtestReceiver(node, imports);
		const frame = getFrame(receiver);
		if (
			!frame
			|| !isWithinIterationCallbackOf(node, frame.callback, imports)
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

		const hookReceiver = getContextHookReceiver(node, imports);
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
			// A hook recorded here always has a context-hook method, so the member is there; the
			// `getTestContext()` form is the one whose callee chain cannot be walked.
			const callee = unwrapTypeScriptExpression(hook.callee);
			yield {
				node: hook,
				messageId: MESSAGE_ID,
				data: {name: callee.property.name},
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

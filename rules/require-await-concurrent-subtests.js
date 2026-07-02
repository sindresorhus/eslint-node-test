import {resolveImports, createContextTracker} from './utils/node-test.js';
import isFunction from './ast/is-function.js';

const MESSAGE_ID = 'require-await-concurrent-subtests';

const messages = {
	[MESSAGE_ID]: 'Subtests created in a `{{method}}()` callback are not awaited, so they are cancelled when the parent test finishes. Use `await Promise.all(items.map(item => t.test(…)))`.',
};

// Array methods commonly used to create one subtest per element.
const ITERATION_METHODS = new Set(['map', 'forEach', 'flatMap']);

/** Find the iteration call (`xs.map(cb)`) whose callback directly encloses `node`, or `undefined`. */
function findEnclosingIterationCall(node) {
	let current = node.parent;
	while (current) {
		if (isFunction(current)) {
			const {parent} = current;
			if (
				parent?.type === 'CallExpression'
				&& parent.callee.type === 'MemberExpression'
				&& !parent.callee.computed
				&& parent.callee.property.type === 'Identifier'
				&& ITERATION_METHODS.has(parent.callee.property.name)
				&& parent.arguments.includes(current)
			) {
				return parent;
			}

			// Any other function is a scope boundary (the test callback or a helper).
			return undefined;
		}

		current = current.parent;
	}
}

/** Whether the iteration call is an argument to a consumed `Promise.all(…)` / `Promise.allSettled(…)`. */
function isAwaitedViaPromiseAll(iterationCall) {
	const {parent} = iterationCall;
	if (
		parent?.type === 'CallExpression'
		&& parent.callee.type === 'MemberExpression'
		&& !parent.callee.computed
		&& parent.callee.property.type === 'Identifier'
		&& (parent.callee.property.name === 'all' || parent.callee.property.name === 'allSettled')
		&& parent.callee.object.type === 'Identifier'
		&& parent.callee.object.name === 'Promise'
		&& parent.arguments.includes(iterationCall)
	) {
		// The `Promise.all(…)` itself must be consumed (awaited, returned, or assigned), not discarded —
		// otherwise the parent test still finishes before the subtests settle. It is discarded when left
		// as a floating bare statement or explicitly thrown away with `void`.
		const {parent: grandparent} = parent;
		const isDiscarded = grandparent?.type === 'ExpressionStatement'
			|| (grandparent?.type === 'UnaryExpression' && grandparent.operator === 'void');
		return !isDiscarded;
	}

	return false;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);

		let problem;
		// A bare-statement subtest is already covered by `no-unawaited-subtest`; this rule covers the
		// expression-body and `return` forms inside an iteration callback that it misses.
		if (isSubtest && node.parent?.type !== 'ExpressionStatement') {
			const iterationCall = findEnclosingIterationCall(node);
			if (iterationCall) {
				const method = iterationCall.callee.property.name;
				// `forEach` discards its callbacks' results entirely; `map`/`flatMap` are fine only when
				// the resulting array is awaited via `Promise.all`.
				const handled = method !== 'forEach' && isAwaitedViaPromiseAll(iterationCall);
				if (!handled) {
					problem = {
						node,
						messageId: MESSAGE_ID,
						data: {method},
					};
				}
			}
		}

		tracker.update(node);
		return problem;
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Require subtests created in a loop callback to be awaited.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

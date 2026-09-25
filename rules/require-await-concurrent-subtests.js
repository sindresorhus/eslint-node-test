import {resolveImports, createContextTracker} from './utils/node-test.js';
import isFunction from './ast/is-function.js';
import {skipExpressionWrappers, outermostExpressionWrapper, getFloatingStatement} from './utils/index.js';

const MESSAGE_ID = 'require-await-concurrent-subtests';

const messages = {
	[MESSAGE_ID]: 'Subtests created in a `{{method}}()` callback are not awaited, so the test continues while they run. Use `await Promise.all(items.map(item => t.test(…)))`.',
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

/** Whether a `Promise.all(…)` / `Promise.allSettled(…)` call is itself consumed rather than discarded. */
function isConsumedPromiseAll(promiseAllCall) {
	// The `Promise.all(…)` itself must be consumed (awaited, returned, or assigned), not discarded —
	// otherwise the parent test still finishes before the subtests settle. It is discarded when left
	// as a floating bare statement or explicitly thrown away with `void`.
	const grandparent = skipExpressionWrappers(promiseAllCall.parent);
	const isDiscarded = grandparent?.type === 'ExpressionStatement'
		|| (grandparent?.type === 'UnaryExpression' && grandparent.operator === 'void');
	return !isDiscarded;
}

/** Whether `node` is an argument to a consumed `Promise.all(…)` / `Promise.allSettled(…)`. */
function isArgumentToConsumedPromiseAll(node) {
	const {parent} = node;
	return parent?.type === 'CallExpression'
		&& parent.callee.type === 'MemberExpression'
		&& !parent.callee.computed
		&& parent.callee.property.type === 'Identifier'
		&& (parent.callee.property.name === 'all' || parent.callee.property.name === 'allSettled')
		&& parent.callee.object.type === 'Identifier'
		&& parent.callee.object.name === 'Promise'
		&& parent.arguments.includes(node)
		&& isConsumedPromiseAll(parent);
}

/**
Whether the iteration call's promises are collected by a consumed `Promise.all(…)`.

Both the inline shape (`await Promise.all(xs.map(…))`) and the two-step shape
(`const promises = xs.map(…); await Promise.all(promises)`) are accepted.

Only those two shapes. The array has to reach `Promise.all(…)` as a plain argument, because
following the value any further is data flow analysis this rule does not do. A two-step form that
copies it on the way, as in `await Promise.all([...promises])`, is reported even though the
subtests do settle; the rule documentation says so.
*/
function isAwaitedViaPromiseAll(iterationCall, sourceCode) {
	// A cast around the array (`xs.map(…) as Promise<void>[]`) is what `Promise.all()` actually
	// receives as its argument, so compare against the outermost wrapper.
	const argument = outermostExpressionWrapper(iterationCall);
	if (isArgumentToConsumedPromiseAll(argument)) {
		return true;
	}

	// Two-step form: the array is bound to a variable that is later passed to a consumed
	// `Promise.all(…)`.
	const {parent} = argument;
	if (parent?.type !== 'VariableDeclarator' || parent.init !== argument || parent.id.type !== 'Identifier') {
		return false;
	}

	// Resolve the name from its declaration, not from the subtest call, where a callback parameter of
	// the same name (`xs.map(promises => t.test(promises))`) would hide it.
	const [variable] = sourceCode.getDeclaredVariables(parent);
	// A cast on the reference (`Promise.all(promises!)`) is what `Promise.all()` receives, so compare
	// against the outermost wrapper, as the inline form does.
	return variable.references.some(reference => isArgumentToConsumedPromiseAll(outermostExpressionWrapper(reference.identifier)));
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		const isSubtest = tracker.isSubtestCall(node);

		let problem;
		// A subtest discarded at statement level is already covered by `no-unawaited-subtest`; this
		// rule covers the expression-body and `return` forms inside an iteration callback that it misses.
		if (isSubtest && !getFloatingStatement(node)) {
			const iterationCall = findEnclosingIterationCall(node);
			if (iterationCall) {
				const method = iterationCall.callee.property.name;
				// `forEach` discards its callbacks' results entirely; `map`/`flatMap` are fine only when
				// the resulting array is awaited via `Promise.all`.
				const handled = method !== 'forEach' && isAwaitedViaPromiseAll(iterationCall, sourceCode);
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

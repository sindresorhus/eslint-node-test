import {resolveImports, parseTestCall, getStaticString} from './utils/node-test.js';
import {isLoop, isFunction} from './ast/index.js';

const MESSAGE_ID = 'no-loop-static-title';

const messages = {
	[MESSAGE_ID]: 'This title is static but generated in a loop, so every iteration registers the same title. Include the loop variable so each title is unique.',
};

// Array methods whose callback is commonly used to generate one test per element.
const ITERATION_METHODS = new Set(['map', 'forEach', 'flatMap']);

/** Whether `callExpression` is an iteration method call (`xs.map(fn)`) whose callback is `callback`. */
function isIterationCall(callExpression, callback) {
	const {callee} = callExpression;
	return (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.property.type === 'Identifier'
		&& ITERATION_METHODS.has(callee.property.name)
		&& callExpression.arguments.includes(callback)
	);
}

/*
Whether the test/suite call repeats across a loop without an intervening test/suite scope.
Walking up from the call: a loop means it repeats; the first enclosing function that is an
iteration callback (`xs.map(…)`) also means it repeats; any other function is a scope boundary
(a `describe`/test callback or helper) under which the static title is no longer a duplicate.
*/
function isInRepeatingScope(node) {
	let current = node.parent;
	while (current) {
		if (isLoop(current)) {
			return true;
		}

		if (isFunction(current)) {
			return current.parent?.type === 'CallExpression' && isIterationCall(current.parent, current);
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

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (parsed?.kind !== 'test' && parsed?.kind !== 'suite') {
			return;
		}

		// A static title resolves to a constant string; a title that interpolates the loop variable
		// does not, so it is correctly left alone.
		if (getStaticString(node.arguments[0], context) === undefined) {
			return;
		}

		if (!isInRepeatingScope(node)) {
			return;
		}

		return {
			node: node.arguments[0],
			messageId: MESSAGE_ID,
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow a static test or suite title inside a loop.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

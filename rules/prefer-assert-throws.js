import {resolveImports, parseAssertionCall} from './utils/node-test.js';
import containsSuspensionPoint from './utils/contains-suspension-point.js';
import isFunction from './ast/is-function.js';

const MESSAGE_ID_SYNC = 'prefer-assert-throws/sync';
const MESSAGE_ID_ASYNC = 'prefer-assert-throws/async';

const messages = {
	[MESSAGE_ID_SYNC]: 'Prefer `assert.throws()` over try/catch with an assertion.',
	[MESSAGE_ID_ASYNC]: 'Prefer `assert.rejects()` over try/catch with an assertion.',
};

/*
Return true if the catch block contains at least one assertion call anywhere inside it. `assert.fail()`
is excluded: a bare `fail()` in a catch asserts that the try body should *not* throw, which is the
opposite of the `assert.throws()` pattern this rule suggests.
*/
function catchHasAssertion(catchClause, imports, visitorKeys) {
	function walk(node) {
		// Do not descend into nested functions — an assertion defined there is not executed by the
		// catch itself, so it does not make this try/catch the `assert.throws()` pattern.
		if (isFunction(node)) {
			return false;
		}

		const assertion = node.type === 'CallExpression' ? parseAssertionCall(node, imports) : undefined;
		if (assertion && assertion.method !== 'fail') {
			return true;
		}

		for (const key of visitorKeys[node.type] ?? []) {
			const child = node[key];
			for (const childNode of Array.isArray(child) ? child : [child]) {
				if (childNode?.type && walk(childNode)) {
					return true;
				}
			}
		}

		return false;
	}

	return walk(catchClause.body);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);

	if (!imports.isAssertOrTestFile) {
		return;
	}

	const {visitorKeys} = context.sourceCode;

	context.on('TryStatement', node => {
		// Must have a catch clause — otherwise there is no assertion to move.
		if (!node.handler) {
			return;
		}

		// The try body must have at least one statement (the throwing code).
		if (node.block.body.length === 0) {
			return;
		}

		// The catch clause must contain an assertion.
		if (!catchHasAssertion(node.handler, imports, visitorKeys)) {
			return;
		}

		// A suspension point (`await`, `for await`) in the try body makes it async.
		const isAsync = node.block.body.some(statement => containsSuspensionPoint(statement, visitorKeys));

		return {
			node,
			messageId: isAsync ? MESSAGE_ID_ASYNC : MESSAGE_ID_SYNC,
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer `assert.throws()`/`assert.rejects()` over try/catch with an assertion.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

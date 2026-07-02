import {resolveImports, parseAssertionCall} from './utils/node-test.js';
import isFunction from './ast/is-function.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID_ERROR = 'no-assert-throws-async/error';
const MESSAGE_ID_SUGGESTION = 'no-assert-throws-async/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: '`{{method}}` does not catch an async function, which never throws synchronously. Use `{{replacement}}` instead.',
	[MESSAGE_ID_SUGGESTION]: 'Replace with `{{replacement}}`.',
};

const SYNC_TO_ASYNC = new Map([
	['throws', 'rejects'],
	['doesNotThrow', 'doesNotReject'],
]);

/*
Walk up the ancestor chain to find the nearest enclosing function node.
Returns `undefined` if we hit the program root first.
*/
function findEnclosingFunction(node) {
	let current = node.parent;
	while (current) {
		if (isFunction(current)) {
			return current;
		}

		current = current.parent;
	}
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		const assertion = parseAssertionCall(node, imports);
		if (!assertion) {
			return;
		}

		const replacement = SYNC_TO_ASYNC.get(assertion.method);
		if (!replacement) {
			return;
		}

		const [firstArgument] = node.arguments;
		if (!firstArgument) {
			return;
		}

		const callback = unwrapTypeScriptExpression(firstArgument);
		if (!isFunction(callback) || !callback.async) {
			return;
		}

		const {callee} = node;
		const data = {method: assertion.method, replacement};
		const problem = {
			node: callee,
			messageId: MESSAGE_ID_ERROR,
			data,
		};

		// Only the member forms (`assert.throws`, `t.assert.throws`) can be rewritten. A bare named
		// import (`throws`) would reference an unimported `rejects`, so leave it reported but unfixed.
		if (callee.type === 'MemberExpression') {
			const isAwaited = node.parent?.type === 'AwaitExpression';
			const enclosingFunction = findEnclosingFunction(node);
			// Prepend `await` only where it is both valid and needed: a bare call statement inside an
			// async function. Otherwise just switch the method and let `no-unawaited-rejects` guide the await.
			const shouldAwait = !isAwaited
				&& node.parent?.type === 'ExpressionStatement'
				&& enclosingFunction?.async === true;

			problem.suggest = [
				{
					messageId: MESSAGE_ID_SUGGESTION,
					data,
					* fix(fixer) {
						yield fixer.replaceText(callee.property, replacement);
						if (shouldAwait) {
							yield fixer.insertTextBefore(node, 'await ');
						}
					},
				},
			];
		}

		return problem;
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow passing an async function to `assert.throws()`/`assert.doesNotThrow()`.',
			recommended: 'unopinionated',
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

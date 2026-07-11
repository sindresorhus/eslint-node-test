import {
	resolveImports,
	parseAssertionCall,
	createContextTracker,
	isAssertionCallWithSupportedContext,
} from './utils/node-test.js';
import isFunction from './ast/is-function.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

/**
@import {TSESTree as ESTree} from '@typescript-eslint/types';
@import * as ESLint from 'eslint';
*/

const MESSAGE_ID = 'no-unneeded-async-rejects-callback';
const messages = {
	[MESSAGE_ID]: 'Remove the unneeded `async` and `await` from this `rejects()` callback.',
};

function getAwaitExpression(callback) {
	const {body} = callback;
	if (body.type === 'AwaitExpression') {
		return {awaitExpression: body, needsReturn: false};
	}

	if (body.type !== 'BlockStatement' || body.body.length !== 1) {
		return;
	}

	const [statement] = body.body;
	if (statement.type === 'ExpressionStatement' && statement.expression.type === 'AwaitExpression') {
		return {awaitExpression: statement.expression, needsReturn: true};
	}

	if (statement.type === 'ReturnStatement' && statement.argument?.type === 'AwaitExpression') {
		return {awaitExpression: statement.argument, needsReturn: false};
	}
}

/** @param {ESLint.Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		const parsed = parseAssertionCall(node, imports);
		const isSupportedContext = isAssertionCallWithSupportedContext(node, tracker);
		tracker.update(node);

		if (parsed?.method !== 'rejects' || !isSupportedContext) {
			return;
		}

		const [firstArgument] = node.arguments;
		if (!firstArgument || firstArgument.type === 'SpreadElement') {
			return;
		}

		const callback = unwrapTypeScriptExpression(firstArgument);
		if (
			!isFunction(callback)
			|| !callback.async
			|| callback.generator
			|| (callback.type === 'ArrowFunctionExpression' && callback.typeParameters)
			|| callback.params.length > 0
		) {
			return;
		}

		const awaited = getAwaitExpression(callback);
		if (!awaited) {
			return;
		}

		return {
			node: callback,
			messageId: MESSAGE_ID,
			/** @param {ESLint.Rule.RuleFixer} fixer */
			* fix(fixer, {abort}) {
				if (sourceCode.getCommentsInside(callback).length > 0) {
					return abort();
				}

				const asyncToken = sourceCode.getFirstToken(callback);
				const tokenAfterAsync = sourceCode.getTokenAfter(asyncToken);
				yield fixer.removeRange([sourceCode.getRange(asyncToken)[0], sourceCode.getRange(tokenAfterAsync)[0]]);

				const awaitToken = sourceCode.getFirstToken(awaited.awaitExpression);
				if (awaited.needsReturn) {
					yield fixer.replaceText(awaitToken, 'return');
				} else {
					const tokenAfterAwait = sourceCode.getTokenAfter(awaitToken);
					yield fixer.removeRange([sourceCode.getRange(awaitToken)[0], sourceCode.getRange(tokenAfterAwait)[0]]);
				}
			},
		};
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {ESLint.Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow unneeded async callbacks passed to `assert.rejects()`.',
			recommended: 'unopinionated',
		},
		fixable: 'code',
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

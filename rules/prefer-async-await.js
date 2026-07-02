import {findVariable} from '@eslint-community/eslint-utils';
import {resolveImports, parseTestCall, getTestCallback} from './utils/node-test.js';

const MESSAGE_ID = 'prefer-async-await/error';

const messages = {
	[MESSAGE_ID]: 'Prefer async/await instead of returning a Promise.',
};

/**
Collect all `return` statements that are directly inside `block`, descending
into control-flow nodes but not into nested functions.

@param {import('estree').BlockStatement} block
@returns {import('estree').ReturnStatement[]}
*/
function findReturnStatements(block) {
	const results = [];

	function walk(node) {
		if (!node) {
			return;
		}

		switch (node.type) {
			case 'ReturnStatement': {
				results.push(node);
				break;
			}

			case 'BlockStatement': {
				for (const statement of node.body) {
					walk(statement);
				}

				break;
			}

			case 'IfStatement': {
				walk(node.consequent);
				walk(node.alternate);
				break;
			}

			case 'SwitchStatement': {
				for (const switchCase of node.cases) {
					for (const statement of switchCase.consequent) {
						walk(statement);
					}
				}

				break;
			}

			case 'TryStatement': {
				walk(node.block);
				if (node.handler) {
					walk(node.handler.body);
				}

				walk(node.finalizer);
				break;
			}

			case 'ForStatement':
			case 'ForInStatement':
			case 'ForOfStatement':
			case 'WhileStatement':
			case 'DoWhileStatement':
			case 'LabeledStatement':
			case 'WithStatement': {
				walk(node.body);
				break;
			}

			// Do not descend into nested functions
			default: {
				break;
			}
		}
	}

	walk(block);

	return results;
}

/**
Check whether a node contains a `.then(...)` call anywhere in its `.then`/`.catch`/`.finally`
member chain.

@param {import('estree').Node | null | undefined} node
@returns {boolean}
*/
function containsThen(node) {
	while (node) {
		if (node.type === 'ChainExpression') {
			node = node.expression;
			continue;
		}

		if (
			node.type !== 'CallExpression'
			|| node.callee.type !== 'MemberExpression'
		) {
			return false;
		}

		const {callee} = node;
		if (
			callee.property.type === 'Identifier'
			&& callee.property.name === 'then'
		) {
			return true;
		}

		node = callee.object;
	}

	return false;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		const parsed = parseTestCall(node, imports);
		if (!parsed) {
			return;
		}

		// `describe`/`suite` callbacks run synchronously and are never awaited, so returning a
		// Promise from them is meaningless and converting to async/await would not help.
		if (parsed.kind === 'suite') {
			return;
		}

		const callback = getTestCallback(node);
		// Only flag non-async functions with a block body (arrow shorthand already returns)
		if (!callback || callback.async || callback.body.type !== 'BlockStatement') {
			return;
		}

		const returnStatements = findReturnStatements(callback.body);
		if (returnStatements.length === 0) {
			return;
		}

		// Flag if any return statement returns a .then() call chain
		for (const returnStatement of returnStatements) {
			if (containsThen(returnStatement.argument)) {
				return {
					node: callback,
					messageId: MESSAGE_ID,
				};
			}
		}

		// Flag if any return statement returns a variable that was assigned from a .then() call
		for (const returnStatement of returnStatements) {
			if (returnStatement.argument?.type !== 'Identifier') {
				continue;
			}

			const variable = findVariable(sourceCode.getScope(returnStatement), returnStatement.argument);
			if (!variable) {
				continue;
			}

			const assignedFromThen = variable.defs.some(
				definition => definition.type === 'Variable' && containsThen(definition.node.init),
			);
			if (assignedFromThen) {
				return {
					node: callback,
					messageId: MESSAGE_ID,
				};
			}
		}
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer async/await over returning a Promise.',
			recommended: true,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

import {
	resolveImports,
	parseTestCall,
	parseAssertionCall,
	getTestCallback,
} from './utils/node-test.js';
import isFunction from './ast/is-function.js';

const MESSAGE_ID = 'require-hook';

const messages = {
	[MESSAGE_ID]: 'This runs when the file is loaded, not as part of a test. Move it into a `before`, `beforeEach`, `after`, or `afterEach` hook.',
};

/*
Whether the statement sits directly in a registration-time scope: the module top level or a
`describe`/`suite` body. Statements inside a test/hook callback or a helper function are fine.
*/
function isInRegistrationScope(statement, imports) {
	const {parent} = statement;
	if (parent.type === 'Program') {
		return true;
	}

	if (parent.type !== 'BlockStatement') {
		return false;
	}

	const callback = parent.parent;
	if (
		!isFunction(callback)
		|| callback.parent?.type !== 'CallExpression'
		|| getTestCallback(callback.parent) !== callback
	) {
		return false;
	}

	return parseTestCall(callback.parent, imports)?.kind === 'suite';
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const allow = new Set(context.options[0].allow);

	context.on('ExpressionStatement', node => {
		const call = node.expression;
		if (call.type !== 'CallExpression') {
			return;
		}

		// The test/suite/hook registration calls themselves belong here.
		if (parseTestCall(call, imports)) {
			return;
		}

		// Misplaced assertions are reported by `no-assert-in-describe`.
		if (parseAssertionCall(call, imports)) {
			return;
		}

		// Check the scope before the `allow` list: it is a few parent lookups, while the list is
		// keyed by callee source text, which has to be materialized for every call it is given.
		if (!isInRegistrationScope(node, imports)) {
			return;
		}

		if (allow.size > 0 && allow.has(sourceCode.getText(call.callee))) {
			return;
		}

		return {node, messageId: MESSAGE_ID};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Require setup and teardown code to be inside a hook.',
			recommended: false,
		},
		schema: [
			{
				type: 'object',
				properties: {
					allow: {
						type: 'array',
						items: {type: 'string'},
						uniqueItems: true,
						description: 'Callee expressions allowed at the top level (for example, `["console.log"]`).',
					},
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{allow: []}],
		messages,
		languages: ['js/js'],
	},
};

export default config;

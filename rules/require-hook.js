import {
	resolveImports,
	parseTestCall,
	parseAssertionCall,
	getTestCallback,
} from './utils/node-test.js';
import isFunction from './ast/is-function.js';
import {unwrapExpression} from './utils/skip-expression-wrappers.js';

const MESSAGE_ID = 'require-hook';

const messages = {
	[MESSAGE_ID]: 'This runs when the file is loaded, not as part of a test. Move it into a `before`, `beforeEach`, `after`, or `afterEach` hook.',
};

/*
`await foo()` and `void foo()` still run `foo()` while the file is loading; only the value is
discarded. Peeling the operators that wrap a call without moving it out of the load phase lets the
rule see the call. `delete foo()` is excluded: it removes a property instead of invoking one.
*/
const VALUE_DISCARDING_OPERATORS = new Set(['void', '!', 'typeof', '+', '-', '~']);

/** Get the call a statement actually invokes, looking through operators that only discard its value. */
function getCalledExpression(statement) {
	let expression = unwrapExpression(statement.expression);

	while (expression.type === 'AwaitExpression' || (expression.type === 'UnaryExpression' && VALUE_DISCARDING_OPERATORS.has(expression.operator))) {
		expression = unwrapExpression(expression.argument);
	}

	return expression;
}

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
	if (!isFunction(callback)) {
		return false;
	}

	// In the descriptor / `options.fn` forms the callback is the `fn` property of an object that is
	// itself an argument, so the enclosing call is two levels above the callback.
	let call = callback.parent;
	if (call?.type === 'Property' && call.parent?.type === 'ObjectExpression') {
		call = call.parent.parent;
	}

	if (call?.type !== 'CallExpression' || getTestCallback(call) !== callback) {
		return false;
	}

	return parseTestCall(call, imports)?.kind === 'suite';
}

/*
Whether a function handed to this call does nothing but register tests, suites, and hooks. That is not
setup that belongs in a hook: it is the same shape as a `describe` body, which the rule leaves alone.
An immediately invoked function or a callback passed to a method is only as suspicious as the calls
inside it, so a body of registrations is left alone wherever it appears.
*/
function isOnlyRegistrations(call, imports) {
	const isRegistration = expression => {
		const called = expression.type === 'ExpressionStatement' ? getCalledExpression(expression) : expression;
		return called.type === 'CallExpression' && Boolean(parseTestCall(called, imports));
	};

	const functions = [call.callee, ...call.arguments]
		.map(argument => unwrapExpression(argument))
		.filter(candidate => isFunction(candidate));

	return functions.length > 0 && functions.every(candidate =>
		(candidate.body.type === 'BlockStatement'
			? candidate.body.body.every(statement => isRegistration(statement))
			: isRegistration(candidate.body)));
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
		const call = getCalledExpression(node);
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

		if (isOnlyRegistrations(call, imports)) {
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

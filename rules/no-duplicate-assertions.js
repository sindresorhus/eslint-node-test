import {
	resolveImports,
	parseTestCall,
	parseSupportedAssertionCall,
	getTestCallback,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	createContextTracker,
	LOOSE_TO_STRICT_METHODS,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';
import {unwrapExpression} from './utils/index.js';
import {functionTypes} from './ast/index.js';

const MESSAGE_ID = 'no-duplicate-assertions';

const messages = {
	[MESSAGE_ID]: 'Duplicate adjacent assertion.',
};

function getAssertionMethod(assertion) {
	if (assertion.isStrict && LOOSE_TO_STRICT_METHODS.has(assertion.method)) {
		return LOOSE_TO_STRICT_METHODS.get(assertion.method);
	}

	return assertion.method;
}

function getAssertionKey(assertionExpression, context, imports, tracker) {
	const {node, isAwaited} = assertionExpression;
	const assertion = parseSupportedAssertionCall(node, imports, tracker);
	if (!assertion) {
		return undefined;
	}

	const argumentKeys = node.arguments.map(argument => {
		if (argument.type === 'SpreadElement') {
			return `...${context.sourceCode.getText(unwrapTypeScriptExpression(argument.argument))}`;
		}

		return context.sourceCode.getText(unwrapTypeScriptExpression(argument));
	});

	return JSON.stringify([isAwaited, getAssertionMethod(assertion), argumentKeys]);
}

function getAssertionExpression(statement) {
	if (statement.type !== 'ExpressionStatement') {
		return undefined;
	}

	// Unwrap on both sides of the `await`, so a cast or an optional chain (`t?.assert.ok(x);`) does
	// not hide the call the way reading `statement.expression` raw would.
	const expression = unwrapExpression(statement.expression);
	if (expression.type === 'CallExpression') {
		return {
			node: expression,
			isAwaited: false,
		};
	}

	if (expression.type === 'AwaitExpression') {
		const argument = unwrapExpression(expression.argument);
		if (argument.type === 'CallExpression') {
			return {
				node: argument,
				isAwaited: true,
			};
		}
	}

	return undefined;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);
	const testCallbackBodies = new WeakSet();

	context.on('CallExpression', node => {
		const isTest = parseTestCall(node, imports)?.kind === 'test' || tracker.isSubtestCall(node);
		tracker.update(node);

		const callback = getTestCallback(node);
		if (
			!isTest
			|| !callback
			|| callback.body.type !== 'BlockStatement'
		) {
			return;
		}

		testCallbackBodies.add(callback.body);
	});

	// A test body the call names out of line is entered where it is declared, which the call's own traversal does not cover, so duplicate assertions in it went unseen. The body is registered the same way, and the block exit below does the rest.

	context.on(functionTypes, node => {
		const call = getOutOfLineCallbackCall(node, context, imports);
		if (getRegistrationKind(call, imports, context) !== 'test' || node.body.type !== 'BlockStatement') {
			return;
		}

		testCallbackBodies.add(node.body);
	});

	context.onExit('BlockStatement', function * (node) {
		if (!testCallbackBodies.has(node)) {
			return;
		}

		let previousAssertionKey;
		for (const statement of node.body) {
			const assertionExpression = getAssertionExpression(statement);
			const assertionKey = assertionExpression
				&& getAssertionKey(assertionExpression, context, imports, tracker);

			if (!assertionKey) {
				previousAssertionKey = undefined;
				continue;
			}

			if (assertionKey === previousAssertionKey) {
				yield {
					node: statement,
					messageId: MESSAGE_ID,
				};
			}

			previousAssertionKey = assertionKey;
		}
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow adjacent duplicate assertions.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

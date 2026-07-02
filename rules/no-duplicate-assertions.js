import {
	resolveImports,
	parseTestCall,
	parseAssertionCall,
	getTestCallback,
	createContextTracker,
} from './utils/node-test.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'no-duplicate-assertions';

const messages = {
	[MESSAGE_ID]: 'Duplicate adjacent assertion.',
};

const STRICT_MODE_METHODS = new Map([
	['equal', 'strictEqual'],
	['notEqual', 'notStrictEqual'],
	['deepEqual', 'deepStrictEqual'],
	['notDeepEqual', 'notDeepStrictEqual'],
]);

function getAssertionMethod(assertion) {
	if (assertion.isStrict && STRICT_MODE_METHODS.has(assertion.method)) {
		return STRICT_MODE_METHODS.get(assertion.method);
	}

	return assertion.method;
}

function getTestContextAssertionName(node) {
	const {callee} = node;
	if (
		callee.type !== 'MemberExpression'
		|| callee.computed
		|| callee.object.type !== 'MemberExpression'
		|| callee.object.computed
		|| callee.object.object.type !== 'Identifier'
		|| callee.object.property.type !== 'Identifier'
		|| callee.object.property.name !== 'assert'
	) {
		return undefined;
	}

	return callee.object.object.name;
}

function getAssertionKey(assertionExpression, context, imports, tracker) {
	const {node, isAwaited} = assertionExpression;
	const assertion = parseAssertionCall(node, imports);
	const testContextName = getTestContextAssertionName(node);
	if (
		!assertion
		|| (
			testContextName !== undefined
			&& !tracker.isContextName(testContextName)
		)
	) {
		return undefined;
	}

	const argumentKeys = node.arguments.map(argument => {
		if (argument.type === 'SpreadElement') {
			return `...${context.sourceCode.getText(unwrapTypeScriptExpression(argument.argument))}`;
		}

		return context.sourceCode.getText(unwrapTypeScriptExpression(argument));
	});

	return `${isAwaited ? 'await ' : ''}${getAssertionMethod(assertion)}(${argumentKeys.join(',')})`;
}

function getAssertionExpression(statement) {
	if (statement.type !== 'ExpressionStatement') {
		return undefined;
	}

	const {expression} = statement;
	if (expression.type === 'CallExpression') {
		return {
			node: expression,
			isAwaited: false,
		};
	}

	if (
		expression.type === 'AwaitExpression'
		&& expression.argument.type === 'CallExpression'
	) {
		return {
			node: expression.argument,
			isAwaited: true,
		};
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
			recommended: false,
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

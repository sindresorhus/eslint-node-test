import {findVariable} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseTestCall,
	parseAssertionCall,
	getTestCallback,
	getSubtestReceiver,
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

function getImportedAssertReference(node, imports) {
	const {callee} = node;
	if (
		callee.type === 'Identifier'
		&& (
			imports.assertNamed.has(callee.name)
			|| imports.assertNamespace.has(callee.name)
		)
	) {
		return callee;
	}

	if (
		callee.type === 'MemberExpression'
		&& !callee.computed
		&& callee.object.type === 'Identifier'
		&& imports.assertNamespace.has(callee.object.name)
	) {
		return callee.object;
	}

	return undefined;
}

function getVariable(identifier, context) {
	if (!identifier) {
		return undefined;
	}

	return findVariable(context.sourceCode.getScope(identifier), identifier);
}

function isImportedBinding(identifier, context) {
	const variable = getVariable(identifier, context);
	return variable?.defs.some(definition => definition.type === 'ImportBinding') ?? false;
}

function isSameVariable(left, right, context) {
	const leftVariable = getVariable(left, context);
	const rightVariable = getVariable(right, context);
	return leftVariable !== undefined && leftVariable === rightVariable;
}

function getCalleeRoot(node) {
	while (
		node.type === 'MemberExpression'
		&& !node.computed
	) {
		node = node.object;
	}

	return node.type === 'Identifier' ? node : undefined;
}

function isImportedTestCall(node, context, imports) {
	const parsed = parseTestCall(node, imports);
	return (
		parsed?.kind === 'test'
		&& isImportedBinding(getCalleeRoot(node.callee), context)
	);
}

function isTrackedSubtestCall(node, context, tracker) {
	const receiver = getSubtestReceiver(node);
	const contextParameter = tracker.currentCallback()?.params[0];
	return (
		receiver !== undefined
		&& contextParameter?.type === 'Identifier'
		&& isSameVariable(receiver, contextParameter, context)
	);
}

function getAssertionKey(assertionExpression, context, imports, tracker) {
	const {node, isAwaited} = assertionExpression;
	const assertion = parseAssertionCall(node, imports);
	const testContextName = getTestContextAssertionName(node);
	const importedAssertReference = getImportedAssertReference(node, imports);
	if (
		!assertion
		|| (
			importedAssertReference
			&& !isImportedBinding(importedAssertReference, context)
		)
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

	return JSON.stringify([isAwaited, getAssertionMethod(assertion), argumentKeys]);
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
		const isTest = isImportedTestCall(node, context, imports) || isTrackedSubtestCall(node, context, tracker);
		if (isTest) {
			tracker.update(node);
		}

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

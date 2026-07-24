import {getStaticValue} from '@eslint-community/eslint-utils';
import {
	resolveImports,
	parseSupportedAssertionCall,
	createContextTracker,
} from './utils/node-test.js';
import {isRegexLiteral} from './ast/index.js';
import {unwrapExpression} from './utils/index.js';

const MESSAGE_ID = 'no-constant-assertion';

const messages = {
	[MESSAGE_ID]: 'This assertion has a constant outcome, so it does not test code behavior.',
};

const COMPARISON_METHODS = new Set([
	'equal',
	'notEqual',
	'strictEqual',
	'notStrictEqual',
	'deepEqual',
	'notDeepEqual',
	'deepStrictEqual',
	'notDeepStrictEqual',
]);

const MATCH_METHODS = new Set([
	'match',
	'doesNotMatch',
]);

const isPrimitiveValue = value => value === null || (typeof value !== 'object' && typeof value !== 'function');

/*
Whether the expression consists entirely of literals and variables bound to a primitive (values that the code under test cannot affect).

A value read through a reference (`array`, `object.property`, `array.slice()`) is intentionally not considered constant, even when its initializer is static, since the object it reads from can be mutated between its definition and the assertion.
*/
function isConstantExpression(node, sourceCode) {
	if (!node) {
		return false;
	}

	node = unwrapExpression(node);

	// Any unary operator (`!`, `-`, `typeof`, …) applied to a constant is still constant.
	while (node.type === 'UnaryExpression') {
		node = unwrapExpression(node.argument);
	}

	switch (node.type) {
		case 'Literal': {
			return true;
		}

		case 'Identifier': {
			const staticValue = getStaticValue(node, sourceCode.getScope(node));

			return staticValue !== null && isPrimitiveValue(staticValue.value);
		}

		case 'TemplateLiteral': {
			return node.expressions.every(expression => isConstantExpression(expression, sourceCode));
		}

		case 'ArrayExpression': {
			return node.elements.every(element => element === null || isConstantExpression(element, sourceCode));
		}

		case 'ObjectExpression': {
			return node.properties.every(property =>
				property.type === 'Property'
				&& (!property.computed || isConstantExpression(property.key, sourceCode))
				&& isConstantExpression(property.value, sourceCode));
		}

		case 'BinaryExpression':
		case 'LogicalExpression': {
			return isConstantExpression(node.left, sourceCode) && isConstantExpression(node.right, sourceCode);
		}

		case 'ConditionalExpression': {
			return isConstantExpression(node.test, sourceCode)
				&& isConstantExpression(node.consequent, sourceCode)
				&& isConstantExpression(node.alternate, sourceCode);
		}

		default: {
			return false;
		}
	}
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	const {sourceCode} = context;
	const tracker = createContextTracker(imports, {trackHooks: true});

	context.on('CallExpression', node => {
		tracker.update(node);

		const assertion = parseSupportedAssertionCall(node, imports, tracker);
		if (!assertion) {
			return;
		}

		if (node.arguments.some(argument => argument.type === 'SpreadElement')) {
			return;
		}

		const {method} = assertion;
		const [firstArgument, secondArgument] = node.arguments;
		let isConstant = false;

		if (method === 'ok' || method === 'ifError') {
			isConstant = isConstantExpression(firstArgument, sourceCode);
		} else if (COMPARISON_METHODS.has(method)) {
			isConstant = isConstantExpression(firstArgument, sourceCode) && isConstantExpression(secondArgument, sourceCode);
		} else if (MATCH_METHODS.has(method)) {
			isConstant = isConstantExpression(firstArgument, sourceCode) && isRegexLiteral(unwrapExpression(secondArgument));
		}

		if (!isConstant) {
			return;
		}

		return {
			node,
			messageId: MESSAGE_ID,
		};
	});

	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow assertions with constant outcomes.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

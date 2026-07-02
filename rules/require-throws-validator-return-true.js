import {getStaticValue} from '@eslint-community/eslint-utils';
import {resolveImports, parseAssertionCall} from './utils/node-test.js';
import isFunction from './ast/is-function.js';
import unwrapTypeScriptExpression from './utils/unwrap-typescript-expression.js';

const MESSAGE_ID = 'require-throws-validator-return-true';

const messages = {
	[MESSAGE_ID]: 'Validator function passed to `assert.{{method}}()` must return the boolean value `true`.',
};

const THROWS_METHODS = new Set(['throws', 'rejects']);
const NON_TRUE_NODE_TYPES = new Set([
	'ArrayExpression',
	'ArrowFunctionExpression',
	'ClassExpression',
	'FunctionExpression',
	'NewExpression',
	'ObjectExpression',
	'TemplateLiteral',
]);

function isAssertionCall(node, imports) {
	node = unwrapTypeScriptExpression(node);
	return node.type === 'CallExpression' && parseAssertionCall(node, imports) !== undefined;
}

function isPromiseStaticCall(node) {
	return node.type === 'CallExpression'
		&& node.callee.type === 'MemberExpression'
		&& !node.callee.computed
		&& node.callee.object.type === 'Identifier'
		&& node.callee.object.name === 'Promise'
		&& node.callee.property.type === 'Identifier';
}

function canReturnTrue(node, context, imports) {
	if (!node) {
		return false;
	}

	node = unwrapTypeScriptExpression(node);

	if (isAssertionCall(node, imports)) {
		return false;
	}

	if (isPromiseStaticCall(node)) {
		return false;
	}

	const staticValue = getStaticValue(node, context.sourceCode.getScope(node));
	if (staticValue) {
		return staticValue.value === true;
	}

	if (NON_TRUE_NODE_TYPES.has(node.type)) {
		return false;
	}

	if (node.type === 'Literal') {
		return node.value === true;
	}

	return true;
}

function hasReturnTrue(functionBody, context, imports) {
	function walk(node) {
		if (node.type === 'ReturnStatement') {
			return canReturnTrue(node.argument, context, imports);
		}

		if (node !== functionBody && isFunction(node)) {
			return false;
		}

		for (const key of context.sourceCode.visitorKeys[node.type] ?? []) {
			const child = node[key];
			for (const childNode of Array.isArray(child) ? child : [child]) {
				if (childNode?.type && walk(childNode)) {
					return true;
				}
			}
		}

		return false;
	}

	return walk(functionBody);
}

function validatorCanReturnTrue(validator, context, imports) {
	if (validator.async || validator.generator) {
		return false;
	}

	if (validator.body.type !== 'BlockStatement') {
		return canReturnTrue(validator.body, context, imports);
	}

	return hasReturnTrue(validator.body, context, imports);
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isAssertOrTestFile) {
		return;
	}

	context.on('CallExpression', node => {
		const parsed = parseAssertionCall(node, imports);
		if (!parsed || !THROWS_METHODS.has(parsed.method)) {
			return;
		}

		const validator = unwrapTypeScriptExpression(node.arguments[1]);
		if (!validator || !isFunction(validator)) {
			return;
		}

		if (validatorCanReturnTrue(validator, context, imports)) {
			return;
		}

		return {
			node: validator,
			messageId: MESSAGE_ID,
			data: {method: parsed.method},
		};
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'problem',
		docs: {
			description: 'Require validator functions in `assert.throws()`/`assert.rejects()` to return `true`.',
			recommended: 'unopinionated',
		},
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

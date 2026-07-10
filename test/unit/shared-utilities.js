import test from 'node:test';
import assert from 'node:assert/strict';
import {Linter} from 'eslint';
import {getStaticStringValue} from '../../rules/ast/index.js';
import {isTypeScriptExpressionWrapper, unwrapTypeScriptExpression} from '../../rules/utils/index.js';
import {removeArgument} from '../../rules/fix/index.js';

// Apply `removeArgument` to the argument at `index` of the `fn(…)` call and return the fixed source.
const removeArgumentFrom = (code, index) => {
	const linter = new Linter();
	const rule = {
		meta: {fixable: 'code'},
		create: context => ({
			CallExpression(node) {
				if (node.callee.name === 'fn' && Object.hasOwn(node.arguments, index)) {
					context.report({node, message: 'x', fix: fixer => removeArgument(fixer, node.arguments[index], context)});
				}
			},
		}),
	};
	const [message] = linter.verify(code, {
		plugins: {test: {rules: {removeArgument: rule}}},
		rules: {'test/removeArgument': 'error'},
		languageOptions: {ecmaVersion: 'latest'},
	});
	const {range, text} = message.fix;
	return code.slice(0, range[0]) + text + code.slice(range[1]);
};

test('getStaticStringValue returns strings from static string nodes', () => {
	assert.strictEqual(getStaticStringValue({
		type: 'Literal',
		value: 'hello',
	}), 'hello');

	assert.strictEqual(getStaticStringValue({
		type: 'TemplateLiteral',
		expressions: [],
		quasis: [
			{
				value: {
					cooked: 'hello',
				},
			},
		],
	}), 'hello');
});

test('getStaticStringValue ignores non-static string nodes', () => {
	assert.strictEqual(getStaticStringValue({
		type: 'Literal',
		value: 1,
	}), undefined);

	assert.strictEqual(getStaticStringValue({
		type: 'TemplateLiteral',
		expressions: [
			{
				type: 'Identifier',
				name: 'value',
			},
		],
		quasis: [],
	}), undefined);
});

test('unwrapTypeScriptExpression unwraps TypeScript expression wrappers', () => {
	const identifier = {
		type: 'Identifier',
		name: 'value',
	};
	const expression = {
		type: 'TSAsExpression',
		expression: {
			type: 'TSSatisfiesExpression',
			expression: {
				type: 'TSNonNullExpression',
				expression: {
					type: 'TSInstantiationExpression',
					expression: {
						type: 'TSTypeAssertion',
						expression: identifier,
					},
				},
			},
		},
	};

	assert.ok(isTypeScriptExpressionWrapper(expression));
	assert.ok(!isTypeScriptExpressionWrapper(identifier));
	assert.strictEqual(unwrapTypeScriptExpression(expression), identifier);
});

test('removeArgument removes the first of several arguments without leaving a stray comma or gap', () => {
	assert.strictEqual(removeArgumentFrom('fn(a, b);', 0), 'fn(b);');
	assert.strictEqual(removeArgumentFrom('fn(a, b, c);', 0), 'fn(b, c);');
	assert.strictEqual(removeArgumentFrom('fn((a), b);', 0), 'fn(b);');
});

test('removeArgument removes a middle or last argument with its preceding comma', () => {
	assert.strictEqual(removeArgumentFrom('fn(a, b);', 1), 'fn(a);');
	assert.strictEqual(removeArgumentFrom('fn(a, b, c);', 1), 'fn(a, c);');
});

test('removeArgument removes the only argument and a dangling trailing comma', () => {
	assert.strictEqual(removeArgumentFrom('fn(a);', 0), 'fn();');
	assert.strictEqual(removeArgumentFrom('fn(a,);', 0), 'fn();');
});

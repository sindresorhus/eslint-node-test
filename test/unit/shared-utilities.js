import test from 'node:test';
import assert from 'node:assert/strict';
import {Linter} from 'eslint';
import {getStaticStringValue} from '../../rules/ast/index.js';
import {
	isTypeScriptExpressionWrapper,
	unwrapTypeScriptExpression,
	unwrapExpression,
	skipExpressionWrappers,
	outermostExpressionWrapper,
	isExpressionWrapper,
	getFloatingStatement,
} from '../../rules/utils/index.js';
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

test('skipExpressionWrappers and outermostExpressionWrapper walk past chain and TypeScript wrappers', () => {
	const call = {type: 'CallExpression'};
	const chain = {type: 'ChainExpression'};
	const cast = {type: 'TSAsExpression'};
	const statement = {type: 'ExpressionStatement'};
	call.parent = chain;
	chain.parent = cast;
	cast.parent = statement;

	assert.strictEqual(skipExpressionWrappers(call.parent), statement);
	assert.strictEqual(outermostExpressionWrapper(call), cast);

	// The two are two views of the same walk.
	assert.strictEqual(skipExpressionWrappers(call.parent), outermostExpressionWrapper(call).parent);
});

test('skipExpressionWrappers and outermostExpressionWrapper pass through unwrapped nodes', () => {
	const call = {type: 'CallExpression'};
	const statement = {type: 'ExpressionStatement'};
	call.parent = statement;

	assert.strictEqual(skipExpressionWrappers(call.parent), statement);
	assert.strictEqual(outermostExpressionWrapper(call), call);
	assert.strictEqual(skipExpressionWrappers(undefined), undefined);
});

test('outermostExpressionWrapper stops at a node with no parent', () => {
	const call = {type: 'CallExpression'};

	assert.strictEqual(outermostExpressionWrapper(call), call);
});

test('unwrapExpression unwraps optional chaining and TypeScript wrappers together', () => {
	const identifier = {type: 'Identifier', name: 'foo'};
	const wrapped = {type: 'ChainExpression', expression: {type: 'TSInstantiationExpression', expression: {type: 'TSNonNullExpression', expression: {type: 'TSAsExpression', expression: identifier}}}};

	assert.strictEqual(unwrapExpression(wrapped), identifier);
	assert.strictEqual(unwrapExpression(identifier), identifier);
	assert.strictEqual(unwrapExpression(undefined), undefined);

	// Unlike `unwrapTypeScriptExpression`, it does not stop at a `ChainExpression`.
	assert.strictEqual(unwrapTypeScriptExpression(wrapped), wrapped);
});

test('isExpressionWrapper recognizes only value-preserving wrappers', () => {
	// `TSInstantiationExpression` (`foo<Bar>`) is a value-preserving wrapper too, so it is unwrapped
	// like the rest — keep it here so it is not accidentally dropped from the wrapper set.
	for (const type of ['ChainExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion', 'TSInstantiationExpression']) {
		assert.ok(isExpressionWrapper({type}), type);
	}

	for (const type of ['CallExpression', 'AwaitExpression', 'ExpressionStatement', 'UnaryExpression']) {
		assert.ok(!isExpressionWrapper({type}), type);
	}

	assert.strictEqual(isExpressionWrapper(undefined), false);
});

// Build a chain of `parent` links from the innermost node outward, mirroring the statement's own
// `expression` reference so `getFloatingStatement` can tell a bare call from a wrapped one.
function chainParents(...nodes) {
	for (const [index, node] of nodes.entries()) {
		const parent = nodes[index + 1];
		node.parent = parent;
		if (parent?.type === 'ExpressionStatement') {
			parent.expression = node;
		}
	}

	return nodes[0];
}

test('getFloatingStatement recognizes bare and `void`-discarded statements', () => {
	const bare = chainParents({type: 'CallExpression'}, {type: 'ExpressionStatement'});
	assert.deepStrictEqual(getFloatingStatement(bare), {statement: bare.parent, canAwait: true});

	const voided = chainParents({type: 'CallExpression'}, {type: 'UnaryExpression', operator: 'void'}, {type: 'ExpressionStatement'});
	assert.deepStrictEqual(getFloatingStatement(voided), {statement: voided.parent.parent, canAwait: false});
});

test('getFloatingStatement skips expression wrappers on both sides of `void`', () => {
	const call = chainParents(
		{type: 'CallExpression'},
		{type: 'TSAsExpression'},
		{type: 'UnaryExpression', operator: 'void'},
		{type: 'TSNonNullExpression'},
		{type: 'ExpressionStatement'},
	);

	assert.deepStrictEqual(getFloatingStatement(call), {statement: call.parent.parent.parent.parent, canAwait: false});
});

test('getFloatingStatement marks a type-asserted bare statement as unawaitable', () => {
	// `call() as T;`, `call() satisfies T;`, and `<T>call();` are floating, but the assertion binds
	// looser than `await`, so `await call() as T` would cast the awaited value, not the Promise.
	for (const type of ['TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion']) {
		const cast = chainParents({type: 'CallExpression'}, {type}, {type: 'ExpressionStatement'});
		assert.deepStrictEqual(getFloatingStatement(cast), {statement: cast.parent.parent, canAwait: false}, type);
	}
});

test('getFloatingStatement keeps a `?.`- or `!`-wrapped bare statement awaitable', () => {
	// `t?.test(…);` and `call()!;` bind tighter than `await`, so prepending it is faithful.
	for (const wrapper of ['ChainExpression', 'TSNonNullExpression']) {
		const wrapped = chainParents({type: 'CallExpression'}, {type: wrapper}, {type: 'ExpressionStatement'});
		assert.deepStrictEqual(getFloatingStatement(wrapped), {statement: wrapped.parent.parent, canAwait: true}, wrapper);
	}
});

test('getFloatingStatement returns undefined when the value is used', () => {
	for (const parent of [{type: 'AwaitExpression'}, {type: 'ReturnStatement'}, {type: 'VariableDeclarator'}]) {
		const call = chainParents({type: 'CallExpression'}, parent);
		assert.strictEqual(getFloatingStatement(call), undefined, parent.type);
	}

	// A node with no parent (the wrapper walk must tolerate `undefined`).
	assert.strictEqual(getFloatingStatement({type: 'CallExpression'}), undefined);

	// A `void` expression whose own value is used is not discarded at statement level.
	const usedVoid = chainParents({type: 'CallExpression'}, {type: 'UnaryExpression', operator: 'void'}, {type: 'VariableDeclarator'});
	assert.strictEqual(getFloatingStatement(usedVoid), undefined);

	// A different unary operator does not discard the value the way `void` does.
	const negated = chainParents({type: 'CallExpression'}, {type: 'UnaryExpression', operator: '!'}, {type: 'ExpressionStatement'});
	assert.strictEqual(getFloatingStatement(negated), undefined);
});

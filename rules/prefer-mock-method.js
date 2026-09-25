import {
	resolveImports,
	createContextTracker,
	getStaticString,
	isGetTestContextCall,
	isGlobalMock,
} from './utils/node-test.js';
import {getParenthesizedRange, isValueNotUsable, unwrapExpression} from './utils/index.js';

/*
The source text of a node as written, parentheses included. `getText` leaves them out, and a node
that needs them back is one a TypeScript wrapper sits under: `t.mock as any.method(…)` does not parse,
`(t.mock as any).method(…)` does. A sequence expression is re-emitted with its parentheses too, which
is why `canRewriteMethodCall` still declines those.
*/
const getWrittenText = (node, context) => context.sourceCode.text.slice(...getParenthesizedRange(node, context));

const MESSAGE_ID_ERROR = 'prefer-mock-method/error';
const MESSAGE_ID_SUGGESTION = 'prefer-mock-method/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: 'Prefer `{{base}}.method()` over assigning `{{base}}.fn()` to a property, so the original method is tracked and can be restored.',
	[MESSAGE_ID_SUGGESTION]: 'Replace with `{{base}}.method()`.',
};

/**
Whether the assignment can be rewritten to `mock.method(…)`: a resolvable key, at most one argument
(the implementation, which becomes the third argument), and no inner comments to drop.

`<obj>.method = mock.fn()` evaluates to the mock function, but `mock.method(…)` returns the original
method, so the suggestion stands down when the assignment's value is used.

The receiver and the computed key are re-emitted as they were written, so a sequence expression keeps
its parentheses. Dropping them would turn one argument into several, and `super` is no value to pass
at all, so `(a, b).method` and `super.method` get no suggestion.
*/
function canRewriteMethodCall({node, left, key, mockArguments, sourceCode}) {
	return key !== undefined
		&& mockArguments.length <= 1
		&& isValueNotUsable(node)
		&& sourceCode.getCommentsInside(node).length === 0
		&& left.object.type !== 'SequenceExpression'
		// `super` names no value to pass, and `mock.method(super, …)` does not parse at all.
		&& left.object.type !== 'Super'
		&& (!left.computed || left.property.type !== 'SequenceExpression')
		&& mockArguments.every(argument => argument.type !== 'SequenceExpression');
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	// Hook callbacks receive a real test context, so `t.mock.fn()` is just as trackable there.
	const tracker = createContextTracker(imports, {trackHooks: true});

	// The context `<ctx>.mock`, seen through optional chaining and TypeScript wrappers.
	const isContextMock = node => {
		node = unwrapExpression(node);
		if (
			node.type !== 'MemberExpression'
			|| node.computed
			|| node.property.type !== 'Identifier'
			|| node.property.name !== 'mock'
		) {
			return false;
		}

		// The receiver is either a context parameter or a `getTestContext()` call, which is the same
		// context.
		const object = unwrapExpression(node.object);
		return (object.type === 'Identifier' && tracker.isContextIdentifier(object))
			|| isGetTestContextCall(object, imports);
	};

	// Keep the context-name stack in sync as we enter and leave test callbacks.
	context.on('CallExpression', node => {
		tracker.update(node);
	});
	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});

	context.on('AssignmentExpression', node => {
		// A cast on the assigned value (`obj.method = mock.fn() as typeof obj.method`) is a natural
		// TypeScript pattern that must not hide the `mock.fn()` call.
		const right = unwrapExpression(node.right);
		if (node.operator !== '=' || node.left.type !== 'MemberExpression' || right.type !== 'CallExpression') {
			return;
		}

		const callee = unwrapExpression(right.callee);
		if (
			callee.type !== 'MemberExpression'
			|| callee.computed
			|| callee.property.type !== 'Identifier'
			|| callee.property.name !== 'fn'
			|| (!isGlobalMock(callee.object, imports) && !isContextMock(callee.object))
		) {
			return;
		}

		const base = getWrittenText(callee.object, context);
		const problem = {
			node,
			messageId: MESSAGE_ID_ERROR,
			data: {base},
		};

		const {left} = node;
		const mockArguments = right.arguments;

		// Resolve the property name to a `mock.method` second argument. That argument must be a
		// string, so a computed key is only rewritten when it is statically one: a number, boolean,
		// `null`, or symbol key would make the rewritten call throw.
		let key;
		if (!left.computed && left.property.type === 'Identifier') {
			key = `'${left.property.name}'`;
		} else if (left.computed && getStaticString(left.property, context) !== undefined) {
			key = sourceCode.getText(left.property);
		}

		// `mock.method()` falls back to the ORIGINAL method when no implementation is passed, while
		// `mock.fn()` returns `undefined`, so the rewrite only preserves behavior with an implementation.
		// Passing `undefined` explicitly does not help: the default parameter still applies.
		const [mockArgument] = mockArguments;
		const unwrappedArgument = mockArgument && unwrapExpression(mockArgument);
		const isUndefinedArgument = unwrappedArgument?.type === 'Identifier' && unwrappedArgument.name === 'undefined';
		const hasImplementation = mockArguments.length === 1 && !isUndefinedArgument;

		if (hasImplementation && canRewriteMethodCall({
			node, left, key, mockArguments, sourceCode,
		})) {
			const objectText = getWrittenText(left.object, context);
			const implementation = mockArguments.length === 1 ? `, ${sourceCode.getText(mockArguments[0])}` : '';
			const replacement = `${base}.method(${objectText}, ${key}${implementation})`;
			problem.suggest = [
				{
					messageId: MESSAGE_ID_SUGGESTION,
					data: {base},
					fix: fixer => fixer.replaceText(node, replacement),
				},
			];
		}

		return problem;
	});
};

/** @type {import('eslint').Rule.RuleModule} */
const config = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Prefer `mock.method()` over assigning `mock.fn()` to an object property.',
			recommended: true,
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

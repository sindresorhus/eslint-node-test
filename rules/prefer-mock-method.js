import {resolveImports, createContextTracker, isGlobalMock} from './utils/node-test.js';
import {isValueNotUsable} from './utils/index.js';

const MESSAGE_ID_ERROR = 'prefer-mock-method/error';
const MESSAGE_ID_SUGGESTION = 'prefer-mock-method/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: 'Prefer `{{base}}.method()` over assigning `{{base}}.fn()` to a property, so the original method is tracked and can be restored.',
	[MESSAGE_ID_SUGGESTION]: 'Replace with `{{base}}.method()`.',
};

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);

	// The context `<ctx>.mock`.
	const isContextMock = node =>
		node.type === 'MemberExpression'
		&& !node.computed
		&& node.property.type === 'Identifier'
		&& node.property.name === 'mock'
		&& node.object.type === 'Identifier'
		&& tracker.isContextName(node.object.name);

	// Keep the context-name stack in sync as we enter and leave test callbacks.
	context.on('CallExpression', node => {
		tracker.update(node);
	});
	context.onExit('CallExpression', node => {
		tracker.leave(node);
	});

	context.on('AssignmentExpression', node => {
		if (node.operator !== '=' || node.left.type !== 'MemberExpression' || node.right.type !== 'CallExpression') {
			return;
		}

		const {callee} = node.right;
		if (
			callee.type !== 'MemberExpression'
			|| callee.computed
			|| callee.property.type !== 'Identifier'
			|| callee.property.name !== 'fn'
			|| (!isGlobalMock(callee.object, imports) && !isContextMock(callee.object))
		) {
			return;
		}

		const base = sourceCode.getText(callee.object);
		const problem = {
			node,
			messageId: MESSAGE_ID_ERROR,
			data: {base},
		};

		const {left} = node;
		const mockArguments = node.right.arguments;

		// Resolve the property name to a `mock.method` second argument.
		let key;
		if (!left.computed && left.property.type === 'Identifier') {
			key = `'${left.property.name}'`;
		} else if (left.computed) {
			key = sourceCode.getText(left.property);
		}

		// Only suggest a rewrite for the simple cases: a resolvable key, at most one argument (the
		// implementation, which becomes `mock.method`'s third argument), and no inner comments to drop.
		// `<obj>.method = mock.fn()` evaluates to the mock function, but `mock.method(…)` returns the
		// original method, so skip the suggestion when the assignment's value is used.
		const canRewrite = key !== undefined
			&& mockArguments.length <= 1
			&& isValueNotUsable(node)
			&& sourceCode.getCommentsInside(node).length === 0;

		if (canRewrite) {
			const objectText = sourceCode.getText(left.object);
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

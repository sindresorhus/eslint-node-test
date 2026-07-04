import {resolveImports, createContextTracker} from './utils/node-test.js';
import isFunction from './ast/is-function.js';

const MESSAGE_ID_ERROR = 'no-skip-without-return/error';
const MESSAGE_ID_SUGGESTION = 'no-skip-without-return/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: '`{{name}}.{{method}}()` does not stop the test; code after it still runs. Return afterwards.',
	[MESSAGE_ID_SUGGESTION]: 'Add `return` after `{{name}}.{{method}}()`.',
};

const SKIP_METHODS = new Set(['skip', 'todo']);

/*
Whether reachable code follows the skip statement before the enclosing test function ends.
Walks outward: a following sibling statement means code runs after the skip, unless the skip
is directly followed by a `return`/`throw`. Only block and program bodies are inspected; a skip
inside a `switch` case is best-effort and not flagged, since detecting it correctly would require
modeling break/return/fall-through control flow.
*/
function hasCodeAfter(skipStatement) {
	let node = skipStatement;
	while (node) {
		const {parent} = node;
		if (!parent) {
			return false;
		}

		if (parent.type === 'BlockStatement' || parent.type === 'Program') {
			const next = parent.body[parent.body.indexOf(node) + 1];
			if (next) {
				// A `return`/`throw` immediately after the skip itself is the correct pattern.
				return !(node === skipStatement && (next.type === 'ReturnStatement' || next.type === 'ThrowStatement'));
			}
		}

		if (isFunction(parent)) {
			return false;
		}

		node = parent;
	}

	return false;
}

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const {sourceCode} = context;
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);

	context.on('CallExpression', node => {
		let problem;

		const {callee, parent} = node;
		if (
			parent.type === 'ExpressionStatement'
			&& callee.type === 'MemberExpression'
			&& !callee.computed
			&& callee.property.type === 'Identifier'
			&& SKIP_METHODS.has(callee.property.name)
			&& callee.object.type === 'Identifier'
			&& tracker.isContextIdentifier(callee.object)
			&& hasCodeAfter(parent)
		) {
			const {name} = callee.object;
			const method = callee.property.name;
			problem = {
				node,
				messageId: MESSAGE_ID_ERROR,
				data: {name, method},
			};

			// Only suggest inserting `return` when the skip is in a block; in a braceless
			// `if (x) t.skip()` the inserted `return` would escape the condition.
			if (parent.parent.type === 'BlockStatement') {
				problem.suggest = [
					{
						messageId: MESSAGE_ID_SUGGESTION,
						data: {name, method},
						fix(fixer) {
							// Insert `return;` on its own line, matching the skip statement's indentation.
							const [start] = sourceCode.getRange(parent);
							const lineStart = sourceCode.text.lastIndexOf('\n', start - 1) + 1;
							const [indentation] = /^\s*/.exec(sourceCode.text.slice(lineStart, start));
							return fixer.insertTextAfter(parent, `\n${indentation}return;`);
						},
					},
				];
			}
		}

		tracker.update(node);
		return problem;
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
			description: 'Disallow `t.skip()`/`t.todo()` without returning afterwards.',
			recommended: true,
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;

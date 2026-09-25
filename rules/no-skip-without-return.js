import {resolveImports, createContextTracker, isGetTestContextCall} from './utils/node-test.js';
import isFunction from './ast/is-function.js';
import {
	getEnclosingFunction,
	getFloatingStatement,
	hasStaticBlockBetween,
	unwrapTypeScriptExpression,
} from './utils/index.js';

const MESSAGE_ID_ERROR = 'no-skip-without-return/error';
const MESSAGE_ID_SUGGESTION = 'no-skip-without-return/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: '`{{name}}.{{method}}()` does not stop the test; code after it still runs. Return afterwards.',
	[MESSAGE_ID_SUGGESTION]: 'Add `return` after `{{name}}.{{method}}()`.',
};

const SKIP_METHODS = new Set(['skip', 'todo']);
// Statements that end the current path, so a skip followed by one of them is already terminal.
const TERMINAL_STATEMENTS = new Set(['ReturnStatement', 'ThrowStatement', 'BreakStatement', 'ContinueStatement']);

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

		// A class static block is a statement list too, so a skip inside one is followed by the same
		// code the rule inspects in a block or at the top level.
		if (['BlockStatement', 'Program', 'StaticBlock'].includes(parent.type)) {
			const next = parent.body[parent.body.indexOf(node) + 1];
			if (next) {
				// A `return`/`throw`/`break`/`continue` immediately after the skip itself is the correct
				// pattern: none of them let further test code run after the skip. A `break` in a `switch`
				// case, in particular, leaves the switch rather than continuing the test.
				return !(node === skipStatement && TERMINAL_STATEMENTS.has(next.type));
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

	// Hook callbacks receive a test context too, so `t.skip()` in a hook body skips the rest of
	// that hook exactly as it does in a test body.
	const tracker = createContextTracker(imports, {trackHooks: true});

	// The name to show for a test-context receiver, or `undefined` when the receiver is some other
	// object's method of the same name.
	const getContextName = receiver => {
		if (receiver.type === 'Identifier') {
			return tracker.isContextIdentifier(receiver) ? receiver.name : undefined;
		}

		// A `getTestContext()` import can be bound to another name, and the message names what the
		// file actually calls.
		return isGetTestContextCall(receiver, imports) && imports.getTestContextName
			? `${imports.getTestContextName}()`
			: undefined;
	};

	context.on('CallExpression', node => {
		let problem;

		const callee = unwrapTypeScriptExpression(node.callee);
		// `t.skip()` can be wrapped in `void` or sit inside a conditional, in which case the statement
		// that discards it is the one whose remaining code runs after the skip.
		const statement = getFloatingStatement(node)?.statement;
		// The receiver is a tracked context parameter or a `getTestContext()` call, behind any
		// TypeScript wrapper.
		const name = callee.type === 'MemberExpression'
			? getContextName(unwrapTypeScriptExpression(callee.object))
			: undefined;

		if (
			statement?.type === 'ExpressionStatement'
			&& callee.type === 'MemberExpression'
			&& !callee.computed
			&& callee.property.type === 'Identifier'
			&& SKIP_METHODS.has(callee.property.name)
			&& name
			&& hasCodeAfter(statement)
		) {
			const method = callee.property.name;
			problem = {
				node,
				messageId: MESSAGE_ID_ERROR,
				data: {name, method},
			};

			// Only suggest inserting `return` when the skip is in a block; in a braceless
			// `if (x) t.skip()` the inserted `return` would escape the condition. A class static block
			// is a statement list but not a function either, so a `return` there is a SyntaxError.
			if (statement.parent.type === 'BlockStatement' && !hasStaticBlockBetween(statement, getEnclosingFunction(statement))) {
				problem.suggest = [
					{
						messageId: MESSAGE_ID_SUGGESTION,
						data: {name, method},
						fix(fixer) {
							// Insert `return;` on its own line, matching the skip statement's indentation.
							// Anchor after a trailing comment on the statement's line, so a comment documenting
							// the skip stays with the skip instead of ending up on the inserted `return`.
							const [start] = sourceCode.getRange(statement);
							const lineStart = sourceCode.text.lastIndexOf('\n', start - 1) + 1;
							const [indentation] = /^\s*/.exec(sourceCode.text.slice(lineStart, start));

							const [trailingComment] = sourceCode.getCommentsAfter(statement);
							const hasTrailingComment = trailingComment
								&& sourceCode.getLoc(trailingComment).start.line === sourceCode.getLoc(statement).end.line;
							const anchor = hasTrailingComment ? trailingComment : statement;

							return fixer.insertTextAfter(anchor, `\n${indentation}return;`);
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

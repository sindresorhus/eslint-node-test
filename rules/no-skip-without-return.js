import {resolveImports, createContextTracker, isGetTestContextCall} from './utils/node-test.js';
import isFunction from './ast/is-function.js';
import isLoop from './ast/is-loop.js';
import {
	getEnclosingFunction,
	getFloatingStatement,
	hasStaticBlockBetween,
	skipExpressionWrappers,
	unwrapTypeScriptExpression,
} from './utils/index.js';

const MESSAGE_ID_ERROR = 'no-skip-without-return/error';
const MESSAGE_ID_SUGGESTION = 'no-skip-without-return/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: '`{{name}}.{{method}}()` does not stop the test; code after it still runs. Return afterwards.',
	[MESSAGE_ID_SUGGESTION]: 'Add `return` after `{{name}}.{{method}}()`.',
};

const SKIP_METHODS = new Set(['skip', 'todo']);

/** The statement written right after `statement` in its own statement list, if there is one. */
function getNextStatement(statement) {
	const {parent} = statement;
	if (!['BlockStatement', 'Program', 'StaticBlock', 'SwitchCase'].includes(parent?.type)) {
		return undefined;
	}

	// A `switch` case holds its statement list in `consequent`.
	const statements = parent.type === 'SwitchCase' ? parent.consequent : parent.body;
	return statements[statements.indexOf(statement) + 1];
}

/**
Whether `call` is the whole of `statement`, alone or under `void`. A skip inside `&&`, `?:`, or a sequence may not run, and a `return` after the statement would run either way, so the suggestion is only offered for the whole statement.
*/
function isWholeStatement(call, statement) {
	const parent = skipExpressionWrappers(call.parent);
	if (parent.type === 'UnaryExpression' && parent.operator === 'void') {
		return skipExpressionWrappers(parent.parent) === statement;
	}

	return parent === statement;
}

/** The statement a `break` exits: the labeled statement it names, or else the innermost loop or `switch` around it. */
function getBreakTarget(breakStatement) {
	for (let node = breakStatement.parent; node && !isFunction(node); node = node.parent) {
		const isTarget = breakStatement.label
			? node.type === 'LabeledStatement' && node.label.name === breakStatement.label.name
			: isLoop(node) || node.type === 'SwitchStatement';
		if (isTarget) {
			return node;
		}
	}

	return undefined;
}

/*
Whether reachable code follows the skip statement before the enclosing test function ends.
Walks outward: a following sibling statement means code runs after the skip, unless the skip
is directly followed by a `return` or `throw`, which end the test body right there. A `break`
or `continue` is not terminal — it leaves the loop or switch the skip sits in, and whatever
follows that construct still runs — so the walk carries on outward past it. A `break` skips
the rest of the construct it exits, so the walk carries on from that construct.
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
		const next = getNextStatement(node);
		if (next) {
			// A `return` or `throw` right after the skip ends the test body there.
			if (next.type === 'ReturnStatement' || next.type === 'ThrowStatement') {
				return false;
			}

			// A `break` or `continue` only leaves the loop or switch, so keep walking outward to the
			// statement list that construct sits in rather than calling the skip terminal.
			if (next.type === 'BreakStatement') {
				node = getBreakTarget(next) ?? parent;
				continue;
			}

			// A `continue` ends only this iteration, and the next one runs the rest of the loop body.
			if (next.type === 'ContinueStatement') {
				node = parent;
				continue;
			}

			return true;
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

		// A `getTestContext()` import can be bound to another name, or read off a test binding
		// (`test.getTestContext()`), and the message names what the file actually calls.
		return isGetTestContextCall(receiver, imports) ? sourceCode.getText(receiver) : undefined;
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
			// A `return` inserted after a `break` or `continue` would leave that statement unreachable,
			// so the skip is reported without a suggestion when the next one jumps.
			const next = getNextStatement(statement);
			const isFollowedByJump = next?.type === 'BreakStatement' || next?.type === 'ContinueStatement';
			if (isWholeStatement(node, statement) && !isFollowedByJump && statement.parent.type === 'BlockStatement' && !hasStaticBlockBetween(statement, getEnclosingFunction(statement))) {
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

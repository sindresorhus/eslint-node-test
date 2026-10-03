import {
	resolveImports,
	createContextTracker,
	getOutOfLineCallbackCall,
	getRegistrationKind,
	getContextReceiverText,
} from './utils/node-test.js';
import {
	getEnclosingFunction,
	isGlobalThisMember,
	isNodeInside,
	isUnshadowedGlobal,
	unwrapExpression,
} from './utils/index.js';
import {isStringExpression} from './ast/index.js';

const MESSAGE_ID_ERROR = 'prefer-diagnostic/error';
const MESSAGE_ID_SUGGESTION = 'prefer-diagnostic/suggestion';

const messages = {
	[MESSAGE_ID_ERROR]: 'Prefer `{{context}}.diagnostic()` over `console.{{method}}()` inside a test, so the message is attached to the test as a TAP diagnostic.',
	[MESSAGE_ID_SUGGESTION]: 'Replace with `{{context}}.diagnostic()`.',
};

const CONSOLE_METHODS = new Set(['log', 'info', 'debug']);

// Whether `node` is statically a string: a string literal, a template literal, or a `+` concatenation with such an operand. `diagnostic()` writes its message as it is, so under `node --test` an `undefined` or `null` message fails the whole file and an object prints `[object Object]`.
const isStringArgument = node => isStringExpression(node)
	|| (
		node.type === 'BinaryExpression'
		&& node.operator === '+'
		&& (isStringArgument(node.left) || isStringArgument(node.right))
	);

/** @param {import('eslint').Rule.RuleContext} context */
const create = context => {
	const imports = resolveImports(context);
	if (!imports.isTestFile) {
		return;
	}

	const tracker = createContextTracker(imports);
	// A test body named out of line (`test('a', body)`) is entered where it is declared, which the call's own frame does not cover, so it is resolved from its binding instead. Like an inline body, it covers the functions declared in it.
	const getOutOfLineTestBody = node => {
		for (let current = getEnclosingFunction(node); current; current = getEnclosingFunction(current)) {
			if (getRegistrationKind(getOutOfLineCallbackCall(current, context, imports), imports, context) === 'test') {
				return current;
			}
		}
	};

	/*
	The name to call `diagnostic()` on at `node`, or `undefined` when no test context is in scope there.

	The context parameter is only in scope inside the test callback, so there is nothing to rewrite outside one, including in the title/options arguments, which the traversal reaches before the callback, and in a suite callback, which the tracker does not track at all. A nested binding of the same name shadows the context, so `t.diagnostic(…)` there would not reach the test context at all.
	*/
	const getContextName = node => {
		const body = getOutOfLineTestBody(node);
		const callback = tracker.currentCallback();
		// The innermost test body names the context: an out-of-line subtest body declared inside a test callback has its own.
		const isInsideCallback = callback
			&& isNodeInside(node, callback)
			&& !(body && isNodeInside(body, callback));
		const testBody = isInsideCallback ? callback : body;
		if (!testBody) {
			return;
		}

		// The runner passes a context hook its own test context, which has `diagnostic()` too, but the tracker does not track hooks.
		return getContextReceiverText(testBody, node, imports, tracker.isContextReceiver);
	};

	context.on('CallExpression', node => {
		tracker.update(node);

		const callee = unwrapExpression(node.callee);
		if (
			callee.type !== 'MemberExpression'
			|| callee.computed
			|| callee.property.type !== 'Identifier'
			|| !CONSOLE_METHODS.has(callee.property.name)
		) {
			return;
		}

		// A local `console` (a parameter, a declaration, a catch binding) is some other object, and its `log` is not the global's. `globalThis.console` and `global.console` are the same object as the bare global, the way `globalThis.process` is the same as `process`, so long as the receiver is the real global.
		const object = unwrapExpression(callee.object);
		if (!isGlobalThisMember(object, 'console', context) && !isUnshadowedGlobal(object, 'console', context)) {
			return;
		}

		const contextName = getContextName(node);
		if (!contextName) {
			return;
		}

		const method = callee.property.name;
		const data = {context: contextName, method};
		const problem = {
			node: callee,
			messageId: MESSAGE_ID_ERROR,
			data,
		};

		// `diagnostic()` takes a single message, so only suggest a rewrite for a single argument. A spread counts as one argument but stands for any number of values, of which `t.diagnostic(…args)` would print only the first. The message has to be a string, which a spread never statically is. Replacing the whole callee would also drop any comments inside it, such as `console./* trace */log(…)`.
		if (
			node.arguments.length === 1
			&& isStringArgument(node.arguments[0])
			&& context.sourceCode.getCommentsInside(callee).length === 0
		) {
			problem.suggest = [
				{
					messageId: MESSAGE_ID_SUGGESTION,
					data,
					fix: fixer => fixer.replaceText(callee, `${contextName}.diagnostic`),
				},
			];
		}

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
		type: 'suggestion',
		docs: {
			description: 'Prefer the test context `diagnostic()` over `console` inside tests.',
			recommended: false,
		},
		hasSuggestions: true,
		schema: [],
		messages,
		languages: ['js/js'],
	},
};

export default config;
